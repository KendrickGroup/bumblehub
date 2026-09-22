/**
 * The Latigo catalog, as the banner picker sees it.
 *
 * Best sellers come from the Storefront API, where BEST_SELLING is a store-wide
 * sort key. The Admin API has no such key at the query root — it only exists on
 * Collection.products — so the Admin fallbacks approximate it by reading the
 * largest collections and merging them by catalog share, which keeps each
 * collection's real sales order while still mixing Men and Ladies.
 */

import "server-only";
import {
  adminGraphql,
  shopifyConfig,
  ShopifyError,
  storefrontGraphql,
} from "./client";
import { stripBannerEmoji } from "@/lib/radio/banner";

export type CatalogProduct = {
  handle: string;
  title: string;
  url: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  description: string;
  price: string;
  currency: string;
};

export type CatalogStrategy =
  | "storefront-best-selling"
  | "admin-collections"
  | "admin-updated"
  | "none";

export type CatalogResult = {
  products: CatalogProduct[];
  strategy: CatalogStrategy;
};

export const CATALOG_LIMIT = 40;
const COLLECTION_POOL = 4;
const DESCRIPTION_MAX = 140;

type ProductNode = {
  handle?: string | null;
  title?: string | null;
  onlineStoreUrl?: string | null;
  descriptionHtml?: string | null;
  featuredMedia?: {
    preview?: { image?: { url?: string | null; width?: number | null; height?: number | null } | null } | null;
  } | null;
  priceRangeV2?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null;
  } | null;
};

const PRODUCT_FIELDS = `
  handle
  title
  onlineStoreUrl
  descriptionHtml
  featuredMedia { preview { image { url width height } } }
  priceRangeV2 { minVariantPrice { amount currencyCode } }
`;

/** Same product, Storefront names: featuredImage and priceRange, not V2. */
const STOREFRONT_PRODUCT_FIELDS = `
  handle
  title
  onlineStoreUrl
  descriptionHtml
  featuredImage { url width height }
  priceRange { minVariantPrice { amount currencyCode } }
`;

type StorefrontProductNode = {
  handle?: string | null;
  title?: string | null;
  onlineStoreUrl?: string | null;
  descriptionHtml?: string | null;
  featuredImage?: { url?: string | null; width?: number | null; height?: number | null } | null;
  priceRange?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null;
  } | null;
};

function fromStorefront(node: StorefrontProductNode): ProductNode {
  return {
    handle: node.handle,
    title: node.title,
    onlineStoreUrl: node.onlineStoreUrl,
    descriptionHtml: node.descriptionHtml,
    featuredMedia: { preview: { image: node.featuredImage ?? null } },
    priceRangeV2: node.priceRange ?? null,
  };
}

/**
 * Shopify descriptions are theme HTML: entities, <br>, marketing tables. The
 * banner wants one clean sentence, so tags go, entities resolve, and the first
 * sentence is kept whole rather than cut mid-word.
 */
export function pitchFromDescription(html: string): string {
  const text = html
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, " \n ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const firstLine = text.split(/\n/)[0] ?? text;
  const sentence = firstLine.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? firstLine;
  const cleaned = stripBannerEmoji(sentence).trim();
  if (cleaned.length <= DESCRIPTION_MAX) return cleaned;
  const clipped = cleaned.slice(0, DESCRIPTION_MAX);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
}

function normalizeProduct(node: ProductNode): CatalogProduct | null {
  const handle = (node.handle ?? "").trim();
  const title = stripBannerEmoji(node.title ?? "").trim();
  const image = node.featuredMedia?.preview?.image;
  const imageUrl = (image?.url ?? "").trim();
  // onlineStoreUrl comes back null on some products; the handle still routes.
  const url =
    (node.onlineStoreUrl ?? "").trim() ||
    (handle ? `https://${shopifyConfig().storeDomain}/products/${handle}` : "");
  if (!handle || !title || !imageUrl || !url) return null;
  return {
    handle,
    title,
    url,
    image: imageUrl,
    imageWidth: image?.width ?? 0,
    imageHeight: image?.height ?? 0,
    description: pitchFromDescription(node.descriptionHtml ?? ""),
    price: node.priceRangeV2?.minVariantPrice?.amount ?? "",
    currency: node.priceRangeV2?.minVariantPrice?.currencyCode ?? "USD",
  };
}

/** Round-robin the collections by catalog share so the big ones lead. */
function mergeByShare(lists: CatalogProduct[][], limit: number): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();
  const cursors = lists.map(() => 0);
  let guard = 0;
  while (out.length < limit && guard < limit * lists.length + lists.length) {
    guard += 1;
    let moved = false;
    for (let i = 0; i < lists.length; i += 1) {
      const list = lists[i]!;
      while (cursors[i]! < list.length) {
        const item = list[cursors[i]!]!;
        cursors[i] = cursors[i]! + 1;
        moved = true;
        if (seen.has(item.handle)) continue;
        seen.add(item.handle);
        out.push(item);
        break;
      }
      if (out.length >= limit) break;
    }
    if (!moved) break;
  }
  return out;
}

/** The real thing: Shopify's own best-selling order across the whole shop. */
async function storefrontBestSellers(limit: number): Promise<CatalogProduct[]> {
  const data = await storefrontGraphql<{
    products: { nodes: StorefrontProductNode[] };
  }>(
    `query BestSelling($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        nodes { ${STOREFRONT_PRODUCT_FIELDS} }
      }
    }`,
    { first: limit },
  );
  return (data.products?.nodes ?? [])
    .map((node) => normalizeProduct(fromStorefront(node)))
    .filter((item): item is CatalogProduct => item !== null);
}

async function storefrontSearch(
  term: string,
  limit: number,
): Promise<CatalogProduct[]> {
  const data = await storefrontGraphql<{
    products: { nodes: StorefrontProductNode[] };
  }>(
    `query Search($first: Int!, $query: String!) {
      products(first: $first, query: $query, sortKey: RELEVANCE) {
        nodes { ${STOREFRONT_PRODUCT_FIELDS} }
      }
    }`,
    { first: limit, query: `title:*${term}*` },
  );
  return (data.products?.nodes ?? [])
    .map((node) => normalizeProduct(fromStorefront(node)))
    .filter((item): item is CatalogProduct => item !== null);
}

async function bestSellersFromCollections(limit: number): Promise<CatalogProduct[]> {
  const data = await adminGraphql<{
    collections: {
      nodes: { id: string; handle: string; productsCount?: { count: number } | null }[];
    };
  }>(`{
    collections(first: 25) {
      nodes { id handle productsCount { count } }
    }
  }`);

  const ranked = [...(data.collections?.nodes ?? [])]
    .map((node) => ({ ...node, count: node.productsCount?.count ?? 0 }))
    .filter((node) => node.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, COLLECTION_POOL);
  if (ranked.length === 0) return [];

  const lists = await Promise.all(
    ranked.map(async (collection) => {
      try {
        const page = await adminGraphql<{
          collection: { products: { nodes: ProductNode[] } } | null;
        }>(
          `query BestSellers($id: ID!, $first: Int!) {
            collection(id: $id) {
              products(first: $first, sortKey: BEST_SELLING) {
                nodes { ${PRODUCT_FIELDS} }
              }
            }
          }`,
          { id: collection.id, first: limit },
        );
        return (page.collection?.products.nodes ?? [])
          .map(normalizeProduct)
          .filter((item): item is CatalogProduct => item !== null);
      } catch {
        return [];
      }
    }),
  );

  return mergeByShare(lists, limit);
}

async function newestProducts(limit: number): Promise<CatalogProduct[]> {
  const data = await adminGraphql<{ products: { nodes: ProductNode[] } }>(
    `query Newest($first: Int!) {
      products(first: $first, sortKey: PUBLISHED_AT, reverse: true, query: "status:active") {
        nodes { ${PRODUCT_FIELDS} }
      }
    }`,
    { first: limit },
  );
  return (data.products?.nodes ?? [])
    .map(normalizeProduct)
    .filter((item): item is CatalogProduct => item !== null);
}

async function adminSearch(term: string, limit: number): Promise<CatalogProduct[]> {
  const data = await adminGraphql<{ products: { nodes: ProductNode[] } }>(
    `query Search($first: Int!, $query: String!) {
      products(first: $first, query: $query, sortKey: RELEVANCE) {
        nodes { ${PRODUCT_FIELDS} }
      }
    }`,
    { first: limit, query: `status:active AND title:*${term}*` },
  );
  return (data.products?.nodes ?? [])
    .map(normalizeProduct)
    .filter((item): item is CatalogProduct => item !== null);
}

/**
 * Walk the routes in order of how good the answer is. Which scopes this app
 * holds decides where it lands, and the error that surfaces is the first one,
 * since that is the door we wanted open.
 */
async function firstThatAnswers(
  attempts: { strategy: CatalogStrategy; run: () => Promise<CatalogProduct[]> }[],
): Promise<CatalogResult> {
  let firstError: unknown = null;
  for (const attempt of attempts) {
    try {
      const products = await attempt.run();
      if (products.length > 0) return { products, strategy: attempt.strategy };
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
  return { products: [], strategy: "none" };
}

export async function fetchCatalog(limit = CATALOG_LIMIT): Promise<CatalogResult> {
  const config = shopifyConfig();
  if (!config.configured) {
    throw new ShopifyError("not_configured", "Shopify credentials are not set");
  }
  return firstThatAnswers([
    {
      strategy: "storefront-best-selling",
      run: () => storefrontBestSellers(limit),
    },
    { strategy: "admin-collections", run: () => bestSellersFromCollections(limit) },
    { strategy: "admin-updated", run: () => newestProducts(limit) },
  ]);
}

/** Name search for the long tail that never makes the top 40. */
export async function searchCatalog(
  term: string,
  limit = 24,
): Promise<CatalogProduct[]> {
  const clean = term.trim().slice(0, 60).replace(/["\\]/g, "");
  if (!clean) return [];
  const found = await firstThatAnswers([
    { strategy: "storefront-best-selling", run: () => storefrontSearch(clean, limit) },
    { strategy: "admin-updated", run: () => adminSearch(clean, limit) },
  ]);
  return found.products;
}
