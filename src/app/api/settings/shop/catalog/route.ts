/**
 * The picker's product list: top sellers by default, live name search when Dave
 * is hunting something outside them. Signed in only — the shop catalog has no
 * business being fetched by a listener.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  getCatalogSnapshot,
  searchCatalogSafely,
} from "@/lib/shopify/catalog-cache";
import { recordShopifyFailure } from "@/lib/shopify/log";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const propertyId = await getDefaultPropertyIdForUser(user.id);

  if (term) {
    const result = await searchCatalogSafely(term);
    if (!result.ok && result.error && propertyId) {
      await recordShopifyFailure(supabase, propertyId, result.error);
    }
    return NextResponse.json(
      {
        products: result.products,
        strategy: "search",
        stale: false,
        fetchedAt: new Date().toISOString(),
        error: result.error,
      },
      { headers: NO_STORE },
    );
  }

  const snapshot = await getCatalogSnapshot();
  if (!snapshot.ok && snapshot.error && propertyId) {
    await recordShopifyFailure(supabase, propertyId, snapshot.error);
  }
  return NextResponse.json(
    {
      products: snapshot.products,
      strategy: snapshot.strategy,
      stale: snapshot.stale,
      fetchedAt: snapshot.fetchedAt,
      error: snapshot.error,
    },
    { headers: NO_STORE },
  );
}
