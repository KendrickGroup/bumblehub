import { createClient } from "@/lib/supabase/server";
import { LAUNCH_STATIONS } from "./launch-stations";
import {
  RADIO_STATION_COLUMNS,
  type RadioStation,
} from "./types";

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
  return (data as RadioStation[] | null) ?? [];
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
      LAUNCH_STATIONS.map((station) => ({
        property_id: propertyId,
        city_label: station.city_label,
        station_name: station.station_name,
        stream_url: station.stream_url,
        display_order: station.display_order,
        is_visible: true,
      })),
    )
    .select(RADIO_STATION_COLUMNS);

  if (error || !data) {
    return fetchRadioStations(propertyId);
  }
  return data as RadioStation[];
}

export async function countVisibleStations(
  propertyId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("radio_stations")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("is_visible", true);
  return count ?? 0;
}
