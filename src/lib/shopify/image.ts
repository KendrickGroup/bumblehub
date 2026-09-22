/**
 * Shopify's CDN resizes on request, so the well asks for a thumbnail and the
 * expand card asks for the full flat lay. Photos are never re-hosted; the only
 * thing this does is name the size. Uploaded photos pass through untouched.
 */

export function shopifyImageUrl(src: string, width: number): string {
  if (!src) return src;
  try {
    const url = new URL(src);
    const host = url.hostname.toLowerCase();
    const isShopify =
      host === "cdn.shopify.com" ||
      host.endsWith(".shopifycdn.com") ||
      host.endsWith(".myshopify.com");
    if (!isShopify) return src;
    url.searchParams.set("width", String(Math.round(width)));
    return url.toString();
  } catch {
    return src;
  }
}
