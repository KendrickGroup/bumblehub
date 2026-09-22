/**
 * Shopify connection health. Aggregates only — no secret, no token, no scope
 * list beyond naming what is missing, so Settings > System and a quick curl
 * after a deploy can both tell whether the catalog is reachable.
 */

import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/lib/shopify/catalog-cache";
import {
  fetchGrantedScopes,
  missingScopes,
  shopifyConfig,
} from "@/lib/shopify/client";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const config = shopifyConfig();
  const snapshot = await getCatalogSnapshot();

  let missing: string[] = [];
  if (config.configured && !snapshot.ok) {
    try {
      missing = missingScopes(await fetchGrantedScopes());
    } catch {
      // Token itself failed; the error below already says so.
    }
  }

  return NextResponse.json(
    {
      configured: config.configured,
      shop: config.adminDomain,
      apiVersion: config.apiVersion,
      api: "admin-graphql",
      auth: "client_credentials",
      ok: snapshot.ok,
      products: snapshot.products.length,
      strategy: snapshot.strategy,
      stale: snapshot.stale,
      fetchedAt: snapshot.fetchedAt,
      missingScopes: missing,
      error: snapshot.error,
    },
    { headers: NO_STORE },
  );
}
