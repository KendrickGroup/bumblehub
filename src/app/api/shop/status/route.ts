/**
 * Shopify connection health. Aggregates only — no secret, no token, no scope
 * list beyond naming what is missing, so Settings > System and a quick curl
 * after a deploy can both tell whether the catalog is reachable.
 */

import { NextResponse } from "next/server";
import { getCatalogSnapshot, searchCatalogSafely } from "@/lib/shopify/catalog-cache";
import {
  adminGraphql,
  fetchGrantedScopes,
  missingScopes,
  shopifyConfig,
  storefrontGraphql,
} from "@/lib/shopify/client";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Products can be read through either door, and which one answers depends on
 * the scopes the install holds. Reporting both says where to look when the
 * catalog is empty.
 */
async function probe(name: string, run: () => Promise<unknown>) {
  try {
    await run();
    return [name, "ok"] as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    const code = (err as { code?: string }).code ?? "error";
    return [name, `${code}: ${message}`.slice(0, 140)] as const;
  }
}

export async function GET() {
  const config = shopifyConfig();
  const snapshot = await getCatalogSnapshot();
  const doors = Object.fromEntries(
    await Promise.all([
      probe("storefront", () =>
        storefrontGraphql(
          `{ products(first: 1, sortKey: BEST_SELLING) { nodes { handle } } }`,
        ),
      ),
      probe("admin", () =>
        adminGraphql(`{ products(first: 1) { nodes { handle } } }`),
      ),
    ]),
  );

  let missing: string[] = [];
  let granted: string[] = [];
  if (config.configured) {
    try {
      granted = await fetchGrantedScopes();
      missing = missingScopes(granted);
    } catch {
      // Token itself failed; the error below already says so.
    }
  }

  const hit = await searchCatalogSafely("tee");
  const sample = snapshot.products.slice(0, 3).map((p) => ({
    handle: p.handle,
    title: p.title,
    price: `${p.price} ${p.currency}`,
    image: p.image.slice(0, 70),
    pitch: p.description,
  }));

  return NextResponse.json(
    {
      configured: config.configured,
      sample,
      searchTee: { count: hit.products.length, error: hit.error },
      shop: config.adminDomain,
      storeDomain: config.storeDomain,
      apiVersion: config.apiVersion,
      auth: "client_credentials + delegate",
      ok: snapshot.ok,
      products: snapshot.products.length,
      strategy: snapshot.strategy,
      stale: snapshot.stale,
      fetchedAt: snapshot.fetchedAt,
      missingScopes: missing,
      grantedScopes: granted,
      doors,
      error: snapshot.error,
    },
    { headers: NO_STORE },
  );
}
