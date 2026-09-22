import type { SupabaseClient } from "@supabase/supabase-js";
import { LATIGO_COWBOY_URL } from "./ranch";
import { parseBannerFrame, type BannerFrame } from "./banner-frame";

export const BANNER_ART_BUCKET = "banner-art";
export const BANNER_MAX_IMAGES = 24;
export const BANNER_MAX_PICKS = 24;
export const BANNER_LINE_MAX = 200;
export const BANNER_NAME_MAX = 80;
export const BANNER_PITCH_MAX = 140;
export const BANNER_ROTATE_MIN_SEC = 4;
export const BANNER_ROTATE_MAX_SEC = 30;
export const BANNER_ROTATE_DEFAULT_SEC = 8;
export const BANNER_ROTATE_MS = BANNER_ROTATE_DEFAULT_SEC * 1000;
export const BANNER_FADE_MS = 500;
export const BANNER_HOLD_RESUME_MS = 600;
export const BANNER_PRODUCT_STORE_PX = 800;
export const BANNER_TITLE = "LATIGO COWBOY AUTHENTICS";
export const BANNER_CHIP = "See it in the shop";
export const BANNER_DEFAULT_LINE =
  "Sutter Creek, California · latigocowboy.com";

export const DEFAULT_BANNER_LINES = [
  "This ain't fashion. It's heritage.",
  "Not trends. Not costumes. Real cowboys.",
  "Authentic cowboy tees. Made in the USA.",
  "The Cowboy Code. No compromise.",
  "Real cowboys don't follow trends.",
  "Built for American cowboys.",
  "Up to 30% off authentic cowboy tees.",
  "Real heritage. Real savings. Up to 30% off.",
  "Tired of costume-shop western wear?",
  "For cowboys who respect the tradition.",
  "Western wear that doesn't look like a costume.",
  "Made for real cowboys, not fashion shows.",
  "Authentic cowboy tees · up to 30% off",
  "The one night everyone wants to dress like you.",
];

export type BannerProduct = {
  image: string;
  name: string;
  url: string;
  pitch: string;
  /** Shopify handle. Present only on picked products. */
  handle?: string;
  price?: string;
  currency?: string;
  /** Square window into the photo for the 108px well. */
  frame?: BannerFrame;
};

/** Picked from the shop, or hand-uploaded before the picker existed. */
export type BannerSource = "picks" | "uploads";

export type BannerPayload = {
  products: BannerProduct[];
  images: string[];
  lines: string[];
  rotateSeconds: number;
  /** Which list the banner is actually showing. */
  source: BannerSource;
  /** Hand-uploaded products, kept whether or not picks exist. */
  uploads: BannerProduct[];
  picks: BannerProduct[];
};

export function isBannerRotateSeconds(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= BANNER_ROTATE_MIN_SEC &&
    value <= BANNER_ROTATE_MAX_SEC
  );
}

/** Live banner: unset or invalid storage always returns 8 and never throws. */
export function parseBannerRotateSeconds(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return BANNER_ROTATE_DEFAULT_SEC;
  const rounded = Math.round(n);
  return isBannerRotateSeconds(rounded)
    ? rounded
    : BANNER_ROTATE_DEFAULT_SEC;
}

export function parseBannerRotateSecondsFromLayout(
  dashboardLayout: unknown,
): number {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return BANNER_ROTATE_DEFAULT_SEC;
  }
  return parseBannerRotateSeconds(
    (dashboardLayout as Record<string, unknown>).banner_rotate_seconds,
  );
}

function layoutObject(dashboardLayout: unknown): Record<string, unknown> {
  return dashboardLayout && typeof dashboardLayout === "object"
    ? { ...(dashboardLayout as Record<string, unknown>) }
    : {};
}

export function stripBannerEmoji(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\p{Regional_Indicator}/gu, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ ·]+|[ ·]+$/g, "")
    .trim();
}

export function hasBannerEmoji(value: string): boolean {
  return (
    /\p{Extended_Pictographic}/u.test(value) ||
    /\p{Regional_Indicator}/u.test(value)
  );
}

export function jsonBannerPayload(banner: BannerPayload) {
  return {
    banner_products: banner.products,
    banner_images: banner.images,
    banner_lines: banner.lines,
    banner_rotate_seconds: banner.rotateSeconds,
    banner_source: banner.source,
  };
}

export function productNeedsCopy(product: BannerProduct): boolean {
  return !product.name.trim() || !product.url.trim();
}

export function isBannerShopUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "latigocowboy.com" || host === "www.latigocowboy.com") {
      return true;
    }
    return host.endsWith(".myshopify.com");
  } catch {
    return false;
  }
}

export function productHandleFromUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return null;
    return last.slice(0, 80);
  } catch {
    return null;
  }
}

export function bannerProductHref(rawUrl: string): string {
  const utm = new URLSearchParams({
    utm_source: "latigo_radio",
    utm_medium: "banner",
  });
  if (!rawUrl || !isBannerShopUrl(rawUrl)) {
    return `${LATIGO_COWBOY_URL}?${utm.toString()}`;
  }
  const parsed = new URL(rawUrl);
  parsed.searchParams.set("utm_source", "latigo_radio");
  parsed.searchParams.set("utm_medium", "banner");
  const handle = productHandleFromUrl(rawUrl);
  if (handle) parsed.searchParams.set("utm_content", handle);
  else parsed.searchParams.delete("utm_content");
  return parsed.toString();
}

export function emptyBannerProduct(image: string): BannerProduct {
  return { image, name: "", url: "", pitch: "" };
}

function parseOneProduct(raw: unknown): BannerProduct | null {
  if (typeof raw === "string") {
    const image = raw.trim().slice(0, 800);
    if (!image.startsWith("https://")) return null;
    return emptyBannerProduct(image);
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const image = String(row.image ?? row.src ?? "").trim().slice(0, 800);
  if (!image.startsWith("https://")) return null;
  const name = stripBannerEmoji(String(row.name ?? "")).slice(0, BANNER_NAME_MAX);
  const urlRaw = String(row.url ?? "").trim().slice(0, 800);
  const url = urlRaw && isBannerShopUrl(urlRaw) ? urlRaw : "";
  const pitch = stripBannerEmoji(String(row.pitch ?? "")).slice(
    0,
    BANNER_PITCH_MAX,
  );
  const product: BannerProduct = { image, name, url, pitch };
  const handle = String(row.handle ?? "").trim().slice(0, 120);
  if (handle) product.handle = handle;
  const price = String(row.price ?? "").trim().slice(0, 20);
  if (price) product.price = price;
  const currency = String(row.currency ?? "").trim().slice(0, 8);
  if (currency) product.currency = currency;
  const frame = parseBannerFrame(row.frame);
  if (frame) product.frame = frame;
  return product;
}

/** A pick is only usable with the three things Shopify gave it. */
function parseOnePick(raw: unknown): BannerProduct | null {
  const product = parseOneProduct(raw);
  if (!product?.handle || !product.url || !product.name) return null;
  return product;
}

export function parseBannerPicks(dashboardLayout: unknown): BannerProduct[] {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return [];
  const layout = dashboardLayout as Record<string, unknown>;
  const raw = Array.isArray(layout.banner_picks) ? layout.banner_picks : null;
  if (!raw) return [];
  const out: BannerProduct[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const pick = parseOnePick(item);
    if (!pick || seen.has(pick.handle!)) continue;
    seen.add(pick.handle!);
    out.push(pick);
    if (out.length >= BANNER_MAX_PICKS) break;
  }
  return out;
}

export function parseBannerProducts(dashboardLayout: unknown): BannerProduct[] {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return [];
  const layout = dashboardLayout as Record<string, unknown>;
  const fromProducts = Array.isArray(layout.banner_products)
    ? layout.banner_products
    : null;
  const fromImages = Array.isArray(layout.banner_images)
    ? layout.banner_images
    : null;
  const raw = fromProducts && fromProducts.length > 0 ? fromProducts : fromImages;
  if (!raw) return [];
  const out: BannerProduct[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const product = parseOneProduct(item);
    if (!product || seen.has(product.image)) continue;
    seen.add(product.image);
    out.push(product);
  }
  return out;
}

export function parseBannerImages(dashboardLayout: unknown): string[] {
  return parseBannerProducts(dashboardLayout).map((item) => item.image);
}

export function parseBannerLines(
  dashboardLayout: unknown,
): { lines: string[]; missing: boolean } {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return { lines: [...DEFAULT_BANNER_LINES], missing: true };
  }
  const layout = dashboardLayout as Record<string, unknown>;
  if (!("banner_lines" in layout)) {
    return { lines: [...DEFAULT_BANNER_LINES], missing: true };
  }
  return { lines: normalizeBannerLines(layout.banner_lines), missing: false };
}

export function normalizeBannerLines(raw: unknown): string[] {
  if (!Array.isArray(raw) && typeof raw !== "string") return [];
  const rows = Array.isArray(raw) ? raw : String(raw).split("\n");
  const out: string[] = [];
  for (const row of rows) {
    if (typeof row !== "string") continue;
    const line = stripBannerEmoji(row).slice(0, BANNER_LINE_MAX);
    if (!line) continue;
    out.push(line);
  }
  return out;
}

/**
 * Picks win the moment there is one. Hand-uploaded rows stay in storage and
 * keep running the banner until then, so nothing goes dark mid-switch.
 */
function effectiveProducts(
  uploads: BannerProduct[],
  picks: BannerProduct[],
): { products: BannerProduct[]; source: BannerSource } {
  if (picks.length > 0) return { products: picks, source: "picks" };
  return { products: uploads, source: "uploads" };
}

function payloadFrom(layout: unknown): BannerPayload {
  const uploads = parseBannerProducts(layout);
  const picks = parseBannerPicks(layout);
  const { products, source } = effectiveProducts(uploads, picks);
  return {
    products,
    images: products.map((item) => item.image),
    lines: parseBannerLines(layout).lines,
    rotateSeconds: parseBannerRotateSecondsFromLayout(layout),
    source,
    uploads,
    picks,
  };
}

export async function fetchBanner(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<BannerPayload> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  return payloadFrom(data?.dashboard_layout);
}

export async function ensureBannerLines(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<BannerPayload> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  const layout = layoutObject(data?.dashboard_layout);
  const parsed = parseBannerLines(layout);
  const uploads = parseBannerProducts(layout);
  const picks = parseBannerPicks(layout);
  const { products, source } = effectiveProducts(uploads, picks);
  const needsLines = parsed.missing;
  const storedRaw = Array.isArray(layout.banner_lines)
    ? layout.banner_lines.filter((row): row is string => typeof row === "string")
    : [];
  const strippedDiffer =
    !needsLines &&
    (storedRaw.length !== parsed.lines.length ||
      storedRaw.some((row, i) => row !== parsed.lines[i]));
  if (!needsLines && !strippedDiffer) {
    return {
      products,
      images: products.map((item) => item.image),
      lines: parsed.lines,
      rotateSeconds: parseBannerRotateSecondsFromLayout(layout),
      source,
      uploads,
      picks,
    };
  }

  layout.banner_lines = needsLines ? DEFAULT_BANNER_LINES : parsed.lines;
  await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  return {
    products,
    images: products.map((item) => item.image),
    lines: needsLines ? [...DEFAULT_BANNER_LINES] : parsed.lines,
    rotateSeconds: parseBannerRotateSecondsFromLayout(layout),
    source,
    uploads,
    picks,
  };
}

export async function saveBannerLayout(
  supabase: SupabaseClient,
  propertyId: string,
  patch: {
    products?: BannerProduct[];
    picks?: BannerProduct[];
    lines?: string[];
    rotateSeconds?: number;
  },
): Promise<BannerPayload> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  const layout = layoutObject(data?.dashboard_layout);
  if (patch.products) {
    layout.banner_products = patch.products;
    layout.banner_images = patch.products.map((item) => item.image);
  }
  if (patch.picks) {
    layout.banner_picks = patch.picks.slice(0, BANNER_MAX_PICKS);
  }
  if (patch.lines) layout.banner_lines = patch.lines;
  if (
    patch.rotateSeconds != null &&
    isBannerRotateSeconds(patch.rotateSeconds)
  ) {
    layout.banner_rotate_seconds = patch.rotateSeconds;
  }
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  if (error) throw new Error(error.message);
  return payloadFrom(layout);
}

export function bannerStoragePath(
  propertyId: string,
  id: string,
  ext: string,
): string {
  const safe = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${propertyId}/${id}.${safe}`;
}

export function bannerPublicUrl(publicUrl: string, contentHash: string): string {
  return `${publicUrl.split("?")[0]}?v=${contentHash}`;
}

export function storagePathFromBannerUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/object/public/banner-art/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}
