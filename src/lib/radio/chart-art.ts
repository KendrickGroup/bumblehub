import type { SupabaseClient } from "@supabase/supabase-js";
import { US_STATE_NAMES } from "./ranch";

export const CHART_ART_BUCKET = "chart-art";
export const CHART_ART_WX = "WX";
export const CHART_ART_SPORTS = "SPORTS";
export const CHART_ART_MAX_WIDTH = 2400;

export type ChartArtContentType = "image/png" | "image/jpeg" | "image/webp";
export type ChartArtExt = "png" | "jpg" | "webp";

export type ChartArtMap = Record<string, string>;

export type ChartArtSlot = {
  key: string;
  label: string;
};

const SPECIAL_KEYS = new Set([CHART_ART_WX, CHART_ART_SPORTS]);

export function isChartArtKey(value: string): boolean {
  const key = value.trim().toUpperCase();
  if (SPECIAL_KEYS.has(key)) return true;
  return /^[A-Z]{2}$/.test(key) && Boolean(US_STATE_NAMES[key]);
}

export function normalizeChartArtKey(value: string): string | null {
  const key = value.trim().toUpperCase();
  return isChartArtKey(key) ? key : null;
}

export function parseChartArt(dashboardLayout: unknown): ChartArtMap {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return {};
  const raw = (dashboardLayout as Record<string, unknown>).chart_art;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ChartArtMap = {};
  for (const [rawKey, rawUrl] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeChartArtKey(rawKey);
    if (!key || typeof rawUrl !== "string") continue;
    const url = rawUrl.trim().slice(0, 800);
    if (!url.startsWith("https://")) continue;
    out[key] = url;
  }
  return out;
}

export function chartArtSlots(): ChartArtSlot[] {
  const states = Object.entries(US_STATE_NAMES)
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  return [
    ...states,
    { key: CHART_ART_WX, label: "California (WX)" },
    { key: CHART_ART_SPORTS, label: "Sports" },
  ];
}

export function chartArtUrlFor(
  art: ChartArtMap,
  mode: "station" | "wx" | "sports",
  stateCode: string | null,
): string | null {
  if (mode === "wx") return art[CHART_ART_WX] ?? null;
  if (mode === "sports") return art[CHART_ART_SPORTS] ?? null;
  const key = stateCode?.trim().toUpperCase() ?? "";
  return key ? (art[key] ?? null) : null;
}

export function sniffChartArtType(
  bytes: Uint8Array,
  declaredType = "",
): { contentType: ChartArtContentType; ext: ChartArtExt } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { contentType: "image/png", ext: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  const declared = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared === "image/png") return { contentType: "image/png", ext: "png" };
  if (declared === "image/jpeg" || declared === "image/jpg") {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  if (declared === "image/webp") return { contentType: "image/webp", ext: "webp" };
  return null;
}

export function chartArtStoragePath(
  propertyId: string,
  key: string,
  ext: string = "jpg",
): string {
  const safe = ext === "jpeg" ? "jpg" : ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${propertyId}/${key}.${safe}`;
}

export function chartArtStoragePaths(propertyId: string, key: string): string[] {
  return ["png", "jpg", "jpeg", "webp"].map((ext) => `${propertyId}/${key}.${ext}`);
}

export function chartArtPublicUrl(publicUrl: string, contentHash: string): string {
  return `${publicUrl.split("?")[0]}?v=${contentHash}`;
}

export async function fetchChartArt(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<ChartArtMap> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  return parseChartArt(data?.dashboard_layout);
}

export async function saveChartArt(
  supabase: SupabaseClient,
  propertyId: string,
  art: ChartArtMap,
): Promise<ChartArtMap> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  const layout =
    data?.dashboard_layout && typeof data.dashboard_layout === "object"
      ? { ...(data.dashboard_layout as Record<string, unknown>) }
      : {};
  layout.chart_art = art;
  const now = new Date().toISOString();
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: now,
    },
    { onConflict: "property_id" },
  );
  if (error) throw new Error(error.message);
  return art;
}
