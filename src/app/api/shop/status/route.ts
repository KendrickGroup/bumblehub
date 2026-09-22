/**
 * Shopify connection health. Aggregates only — no secret, no token, no scope
 * list beyond naming what is missing, so Settings > System and a quick curl
 * after a deploy can both tell whether the catalog is reachable.
 */

import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/lib/shopify/catalog-cache";
import {
  adminGraphql,
  fetchGrantedScopes,
  missingScopes,
  shopifyConfig,
} from "@/lib/shopify/client";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Field-level authorization runs after the query is parsed, so an ACCESS_DENIED
 * still tells us the shape is right. Lets the queries be verified while the
 * install is missing read_products.
 */
async function shapeCheck(name: string, query: string, variables?: Record<string, unknown>) {
  try {
    await adminGraphql(query, variables);
    return [name, "ok"] as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    const code = (err as { code?: string }).code ?? "error";
    return [name, `${code}: ${message}`.slice(0, 120)] as const;
  }
}

export async function GET() {
  const config = shopifyConfig();
  const snapshot = await getCatalogSnapshot();
  const checks = Object.fromEntries(
    await Promise.all([
      shapeCheck(
        "collections",
        `{ collections(first: 2) { nodes { id handle productsCount { count } } } }`,
      ),
      shapeCheck(
        "collectionProducts",
        `{ collections(first: 1) { nodes { products(first: 1, sortKey: BEST_SELLING) { nodes { handle title onlineStoreUrl descriptionHtml featuredMedia { preview { image { url width height } } } priceRangeV2 { minVariantPrice { amount currencyCode } } } } } } }`,
      ),
      shapeCheck(
        "search",
        `{ products(first: 1, query: "status:active AND title:*tee*", sortKey: RELEVANCE) { nodes { handle title } } }`,
      ),
      shapeCheck(
        "newest",
        `{ products(first: 1, sortKey: PUBLISHED_AT, reverse: true, query: "status:active") { nodes { handle } } }`,
      ),
    ]),
  );

  let missing: string[] = [];
  let granted: string[] = [];
  if (config.configured && !snapshot.ok) {
    try {
      granted = await fetchGrantedScopes();
      missing = missingScopes(granted);
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
      grantedScopes: granted,
      checks,
      error: snapshot.error,
    },
    { headers: NO_STORE },
  );
}
