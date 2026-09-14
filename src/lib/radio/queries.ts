import { createClient } from "@/lib/supabase/server";
import { LAUNCH_STATIONS } from "./launch-stations";
import { parseCallAndFreq } from "./parse-identity";
import { FOURBLE_BASEBALL_RSS } from "./ranch";
import {
  RADIO_STATION_COLUMNS,
  normalizeRadioStation,
  type RadioStation,
} from "./types";
import type { RadioBand } from "./ranch";

function asStations(rows: unknown): RadioStation[] {
  return ((rows as RadioStation[] | null) ?? []).map(normalizeRadioStation);
}

export async function fetchRadioStations(
  propertyId: string,
  opts?: { visibleOnly?: boolean },
): Promise<RadioStation[]> {
  const supabase = await createClient();
  let query = supabase
    .from("radio_stations")
    .select(RADIO_STATION_COLUMNS)
    .eq("property_id", propertyId)
    .order("display_order", { ascending: true });

  if (opts?.visibleOnly) {
    query = query.eq("is_visible", true);
  }

  const { data } = await query;
  return asStations(data);
}

/** Seed launch stations when the hive has none yet. */
export async function ensureLaunchStations(
  propertyId: string,
): Promise<RadioStation[]> {
  const existing = await fetchRadioStations(propertyId);
  if (existing.length > 0) return existing;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("radio_stations")
    .insert(
      LAUNCH_STATIONS.map((station) => {
        const parsed = parseCallAndFreq(station.station_name);
        return {
          property_id: propertyId,
          city_label: station.city_label,
          station_name: station.station_name,
          stream_url: station.stream_url,
          display_order: station.display_order,
          is_visible: true,
          call_sign: parsed.callSign,
          frequency: parsed.frequency,
          band: "fm" as const,
          station_type: "stream" as const,
        };
      }),
    )
    .select(RADIO_STATION_COLUMNS);

  if (error || !data) {
    return fetchRadioStations(propertyId);
  }

  await supabase.from("radio_stations").insert({
    property_id: propertyId,
    city_label: "From the Archive",
    station_name: "Classic Baseball",
    stream_url: FOURBLE_BASEBALL_RSS,
    display_order: 100,
    is_visible: true,
    call_sign: "BASEBALL",
    frequency: "CLASSIC",
    band: "am",
    station_type: "feed",
    timezone: "America/New_York",
  });

  return fetchRadioStations(propertyId);
}

export async function countVisibleStations(
  propertyId: string,
  band?: RadioBand,
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("radio_stations")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("is_visible", true);
  if (band) query = query.eq("band", band);
  const { count } = await query;
  return count ?? 0;
}
