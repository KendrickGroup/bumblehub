import { NextResponse } from "next/server";

/**
 * The banner stores a Shopify CDN file. When that file is replaced, the old
 * URL 404s. This looks up the product's current photo so the well can recover.
 */

const HANDLE = /^[a-z0-9-]{1,120}$/i;
const SHOP = "https://latigocowboy.com";

function httpsImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "cdn.shopify.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const handle = new URL(request.url).searchParams.get("handle")?.trim() ?? "";
  if (!HANDLE.test(handle)) {
    return NextResponse.json({ image: null }, { status: 400 });
  }

  try {
    const response = await fetch(`${SHOP}/products/${handle}.js`, {
      headers: { Accept: "application/json", "User-Agent": "LatigoRadio/1.0" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return NextResponse.json({ image: null }, { status: 404 });
    }
    const product = (await response.json()) as {
      featured_image?: unknown;
      images?: unknown[];
    };
    const image =
      httpsImage(product.featured_image) ??
      httpsImage(product.images?.[0]);
    if (!image) {
      return NextResponse.json({ image: null }, { status: 404 });
    }
    return NextResponse.json(
      { image },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return NextResponse.json({ image: null }, { status: 502 });
  }
}
