import type { SupabaseClient } from "@supabase/supabase-js";
import { US_STATE_NAMES } from "./ranch";
import type { RadioStation } from "./types";

export const CHART_ART_BUCKET = "chart-art";
export const CHART_ART_WX = "WX";
export const CHART_ART_SPORTS = "SPORTS";

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

export function chartArtSlots(stations: RadioStation[]): ChartArtSlot[] {
  const codes = new Set<string>();
  for (const station of stations) {
    if (!station.is_visible) continue;
    const code = station.state_code?.trim().toUpperCase() ?? "";
    if (/^[A-Z]{2}$/.test(code)) codes.add(code);
  }
  const slots: ChartArtSlot[] = [...codes]
    .sort()
    .map((key) => ({
      key,
      label: US_STATE_NAMES[key] ?? key,
    }));
  slots.push({ key: CHART_ART_WX, label: "California (WX)" });
  slots.push({ key: CHART_ART_SPORTS, label: "Sports" });
  return slots;
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

export function chartArtStoragePath(propertyId: string, key: string): string {
  return `${propertyId}/${key}.jpg`;
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
