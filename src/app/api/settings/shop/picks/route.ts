/**
 * The picked set: which shop products the banner rotates, in what order, and
 * where each one's 108px window sits. Photos stay on Shopify's CDN — a pick
 * stores the link and the window, never a copy of the image.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  BANNER_MAX_PICKS,
  BANNER_NAME_MAX,
  BANNER_PITCH_MAX,
  fetchBanner,
  hasBannerEmoji,
  isBannerShopUrl,
  saveBannerLayout,
  stripBannerEmoji,
  type BannerProduct,
} from "@/lib/radio/banner";
import { parseBannerFrame } from "@/lib/radio/banner-frame";

const NO_STORE = { "Cache-Control": "no-store" };

function isShopifyImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "cdn.shopify.com" ||
      host.endsWith(".shopifycdn.com") ||
      host.endsWith(".myshopify.com") ||
      host === "latigocowboy.com" ||
      host === "www.latigocowboy.com"
    );
  } catch {
    return false;
  }
}

function payload(picks: BannerProduct[], source: string) {
  return { banner_picks: picks, banner_source: source, count: picks.length };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json(
      { error: "No default property configured" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const banner = await fetchBanner(supabase, propertyId);
  const picks = [...banner.picks];
  const action = String(body.action ?? "");
  const handle = String(body.handle ?? "").trim().slice(0, 120);

  const save = async (next: BannerProduct[]) => {
    try {
      const saved = await saveBannerLayout(supabase, propertyId, { picks: next });
      return NextResponse.json(payload(saved.picks, saved.source), {
        headers: NO_STORE,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save." },
        { status: 500 },
      );
    }
  };

  if (action === "add") {
    if (picks.length >= BANNER_MAX_PICKS) {
      return NextResponse.json(
        { error: `The banner holds ${BANNER_MAX_PICKS} products.` },
        { status: 400 },
      );
    }
    const product = (body.product ?? {}) as Record<string, unknown>;
    const nextHandle = String(product.handle ?? "").trim().slice(0, 120);
    const name = stripBannerEmoji(String(product.title ?? "")).slice(
      0,
      BANNER_NAME_MAX,
    );
    const url = String(product.url ?? "").trim().slice(0, 800);
    const image = String(product.image ?? "").trim().slice(0, 800);
    const pitch = stripBannerEmoji(String(product.pitch ?? "")).slice(
      0,
      BANNER_PITCH_MAX,
    );
    const price = String(product.price ?? "").trim().slice(0, 20);
    const currency = String(product.currency ?? "USD").trim().slice(0, 8);
    if (!nextHandle || !name) {
      return NextResponse.json({ error: "Missing product." }, { status: 400 });
    }
    if (!isBannerShopUrl(url)) {
      return NextResponse.json({ error: "Bad product link." }, { status: 400 });
    }
    if (!isShopifyImage(image)) {
      return NextResponse.json({ error: "Bad product photo." }, { status: 400 });
    }
    if (picks.some((item) => item.handle === nextHandle)) {
      return NextResponse.json(payload(picks, banner.source), { headers: NO_STORE });
    }
    return save([
      ...picks,
      { handle: nextHandle, name, url, image, pitch, price, currency },
    ]);
  }

  if (action === "remove") {
    if (!handle) {
      return NextResponse.json({ error: "Missing product." }, { status: 400 });
    }
    return save(picks.filter((item) => item.handle !== handle));
  }

  if (action === "frame") {
    const frame = parseBannerFrame(body.frame);
    const index = picks.findIndex((item) => item.handle === handle);
    if (index < 0) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }
    return save(
      picks.map((item, i) => {
        if (i !== index) return item;
        if (!frame) {
          const cleared = { ...item };
          delete cleared.frame;
          return cleared;
        }
        return { ...item, frame };
      }),
    );
  }

  if (action === "pitch") {
    const raw = String(body.pitch ?? "");
    if (hasBannerEmoji(raw)) {
      return NextResponse.json(
        { error: "Pitch cannot include emoji." },
        { status: 400 },
      );
    }
    const pitch = stripBannerEmoji(raw).slice(0, BANNER_PITCH_MAX);
    const index = picks.findIndex((item) => item.handle === handle);
    if (index < 0) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }
    return save(picks.map((item, i) => (i === index ? { ...item, pitch } : item)));
  }

  if (action === "move") {
    const direction = String(body.direction ?? "");
    const index = picks.findIndex((item) => item.handle === handle);
    if (index < 0) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= picks.length) {
      return NextResponse.json(payload(picks, banner.source), { headers: NO_STORE });
    }
    const next = [...picks];
    const moved = next[index]!;
    next[index] = next[target]!;
    next[target] = moved;
    return save(next);
  }

  if (action === "reorder") {
    const order = Array.isArray(body.handles)
      ? body.handles.map((item) => String(item))
      : [];
    if (order.length === 0) {
      return NextResponse.json({ error: "Missing order." }, { status: 400 });
    }
    const byHandle = new Map(picks.map((item) => [item.handle!, item]));
    const next: BannerProduct[] = [];
    for (const key of order) {
      const item = byHandle.get(key);
      if (item) {
        next.push(item);
        byHandle.delete(key);
      }
    }
    for (const leftover of byHandle.values()) next.push(leftover);
    return save(next);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
