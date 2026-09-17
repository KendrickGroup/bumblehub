import type { SupabaseClient } from "@supabase/supabase-js";
import { LATIGO_COWBOY_URL } from "./ranch";

export const BANNER_ART_BUCKET = "banner-art";
export const BANNER_MAX_IMAGES = 24;
export const BANNER_LINE_MAX = 200;
export const BANNER_ROTATE_MS = 8000;
export const BANNER_FADE_MS = 500;
export const BANNER_HREF = LATIGO_COWBOY_URL;
export const BANNER_TITLE = "LATIGO COWBOY AUTHENTICS";
export const BANNER_TITLE_LEFT = "LATIGO COWBOY";
export const BANNER_TITLE_RIGHT = "AUTHENTICS";
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
  "🐂 Authentic cowboy tees 🇺🇸 · up to 30% off",
  "🎃 The one night everyone wants to dress like you.",
];

export type BannerPayload = {
  images: string[];
  lines: string[];
};

function layoutObject(dashboardLayout: unknown): Record<string, unknown> {
  return dashboardLayout && typeof dashboardLayout === "object"
    ? { ...(dashboardLayout as Record<string, unknown>) }
    : {};
}

export function parseBannerImages(dashboardLayout: unknown): string[] {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return [];
  const raw = (dashboardLayout as Record<string, unknown>).banner_images;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const url = item.trim().slice(0, 800);
    if (!url.startsWith("https://")) continue;
    out.push(url);
  }
  return out;
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
    const line = row.trim().slice(0, BANNER_LINE_MAX);
    if (!line) continue;
    out.push(line);
  }
  return out;
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
  const parsed = parseBannerLines(data?.dashboard_layout);
  return {
    images: parseBannerImages(data?.dashboard_layout),
    lines: parsed.lines,
  };
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
  const images = parseBannerImages(data?.dashboard_layout);
  const parsed = parseBannerLines(data?.dashboard_layout);
  if (!parsed.missing) return { images, lines: parsed.lines };

  const layout = layoutObject(data?.dashboard_layout);
  layout.banner_lines = DEFAULT_BANNER_LINES;
  await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  return { images, lines: [...DEFAULT_BANNER_LINES] };
}

export async function saveBannerLayout(
  supabase: SupabaseClient,
  propertyId: string,
  patch: { images?: string[]; lines?: string[] },
): Promise<BannerPayload> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  const layout = layoutObject(data?.dashboard_layout);
  if (patch.images) layout.banner_images = patch.images;
  if (patch.lines) layout.banner_lines = patch.lines;
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  if (error) throw new Error(error.message);
  return {
    images: parseBannerImages(layout),
    lines: parseBannerLines(layout).lines,
  };
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
