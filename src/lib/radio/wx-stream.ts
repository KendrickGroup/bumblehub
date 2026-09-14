import type { SupabaseClient } from "@supabase/supabase-js";
import { RANCH_CITY, RANCH_LAT, RANCH_LON, RANCH_STATE, RANCH_TZ } from "./ranch";
import { isHttpsStreamUrl, type RadioStation } from "./types";

/** Virtual dial id — not a radio_stations row. */
export const WX_STATION_ID = "wx:broadcast";

/**
 * HTTPS listen URL for NOAA Weather Radio KEC57 (Zeno.FM relay).
 * Covers Amador & El Dorado (Wolf Mountain / Sacramento NWR).
 */
export const DEFAULT_WX_STREAM_URL = "https://stream.zeno.fm/1tbnw7b4kqhuv";

export function parseWxStreamUrl(dashboardLayout: unknown): {
  url: string;
  missing: boolean;
} {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return { url: DEFAULT_WX_STREAM_URL, missing: true };
  }
  const layout = dashboardLayout as Record<string, unknown>;
  if (!("wx_stream_url" in layout)) {
    return { url: DEFAULT_WX_STREAM_URL, missing: true };
  }
  const raw = layout.wx_stream_url;
  if (typeof raw !== "string") return { url: "", missing: false };
  const trimmed = raw.trim().slice(0, 500);
  if (!trimmed) return { url: "", missing: false };
  return { url: isHttpsStreamUrl(trimmed) ? trimmed : "", missing: false };
}

function layoutObject(dashboardLayout: unknown): Record<string, unknown> {
  return dashboardLayout && typeof dashboardLayout === "object"
    ? { ...(dashboardLayout as Record<string, unknown>) }
    : {};
}

/** Seed the default KEC57 relay when the hive has never set a weather URL. */
export async function ensureWxStreamUrl(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<string> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  const parsed = parseWxStreamUrl(data?.dashboard_layout);
  if (!parsed.missing) return parsed.url;

  const layout = layoutObject(data?.dashboard_layout);
  layout.wx_stream_url = DEFAULT_WX_STREAM_URL;
  const now = new Date().toISOString();
  await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: now,
    },
    { onConflict: "property_id" },
  );
  return DEFAULT_WX_STREAM_URL;
}

export async function saveWxStreamUrl(
  supabase: SupabaseClient,
  propertyId: string,
  url: string,
): Promise<string> {
  const trimmed = url.trim().slice(0, 500);
  const next = trimmed && isHttpsStreamUrl(trimmed) ? trimmed : "";
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  const layout = layoutObject(data?.dashboard_layout);
  layout.wx_stream_url = next;
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
  return next;
}

export function makeWxStation(streamUrl: string): RadioStation {
  return {
    id: WX_STATION_ID,
    property_id: "",
    city_label: `${RANCH_CITY}, ${RANCH_STATE}`,
    station_name: "Latigo WX",
    stream_url: streamUrl,
    display_order: 0,
    is_visible: true,
    created_at: "",
    call_sign: "LATIGO",
    frequency: "WX",
    band: "am",
    station_type: "stream",
    latitude: RANCH_LAT,
    longitude: RANCH_LON,
    state_code: "CA",
    timezone: RANCH_TZ,
  };
}
