/**
 * One hourly catalog read for the whole app.
 *
 * The picker is the only thing that needs Shopify: picked products are stored
 * whole (title, photo, price, link) on the property, so a listener on the
 * public radio never triggers a Shopify call and an outage can't reach them.
 */

import "server-only";
import { unstable_cache } from "next/cache";
import { fetchCatalog, searchCatalog, type CatalogProduct, type CatalogStrategy } from "./catalog";
import { ShopifyError, shopifyConfig } from "./client";

export const CATALOG_TAG = "shopify-catalog";
const CATALOG_TTL_SECONDS = 3600;

export type CatalogSnapshot = {
  products: CatalogProduct[];
  strategy: CatalogStrategy;
  fetchedAt: string;
  ok: boolean;
  /** Present when this snapshot is stale or empty because Shopify failed. */
  error: { code: string; message: string } | null;
  stale: boolean;
};

/** Survives between requests on a warm instance, in front of the data cache. */
let lastGood: CatalogSnapshot | null = null;

const readCatalog = unstable_cache(
  async () => {
    const result = await fetchCatalog();
    return {
      products: result.products,
      strategy: result.strategy,
      fetchedAt: new Date().toISOString(),
    };
  },
  ["shopify-catalog-v1"],
  { revalidate: CATALOG_TTL_SECONDS, tags: [CATALOG_TAG] },
);

function errorOf(err: unknown): { code: string; message: string } {
  if (err instanceof ShopifyError) return { code: err.code, message: err.message };
  return {
    code: "fetch_failed",
    message: err instanceof Error ? err.message : "Shopify did not answer",
  };
}

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  if (!shopifyConfig().configured) {
    return {
      products: [],
      strategy: "none",
      fetchedAt: new Date().toISOString(),
      ok: false,
      error: { code: "not_configured", message: "Shopify credentials are not set" },
      stale: false,
    };
  }
  try {
    const fresh = await readCatalog();
    lastGood = { ...fresh, ok: true, error: null, stale: false };
    return lastGood;
  } catch (err) {
    const error = errorOf(err);
    if (lastGood) return { ...lastGood, ok: false, error, stale: true };
    return {
      products: [],
      strategy: "none",
      fetchedAt: new Date().toISOString(),
      ok: false,
      error,
      stale: false,
    };
  }
}

export type SearchResult = {
  products: CatalogProduct[];
  ok: boolean;
  error: { code: string; message: string } | null;
};

/** Search is live: the long tail can't be guessed an hour ahead. */
export async function searchCatalogSafely(term: string): Promise<SearchResult> {
  if (!shopifyConfig().configured) {
    return {
      products: [],
      ok: false,
      error: { code: "not_configured", message: "Shopify credentials are not set" },
    };
  }
  try {
    return { products: await searchCatalog(term), ok: true, error: null };
  } catch (err) {
    return { products: [], ok: false, error: errorOf(err) };
  }
}
