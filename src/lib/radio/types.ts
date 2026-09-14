import type { RadioBand, RadioStationType } from "./ranch";

export type { RadioBand, RadioStationType };

export type RadioStation = {
  id: string;
  property_id: string;
  city_label: string;
  station_name: string;
  stream_url: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  call_sign: string | null;
  frequency: string | null;
  band: RadioBand;
  station_type: RadioStationType;
  latitude: number | null;
  longitude: number | null;
  state_code: string | null;
  timezone: string | null;
};

export type LaunchStation = {
  city_label: string;
  station_name: string;
  stream_url: string;
  display_order: number;
};

export type RadioSearchResult = {
  stationuuid: string;
  name: string;
  country: string;
  countrycode: string;
  state: string;
  bitrate: number;
  votes: number;
  clickcount: number;
  tags: string[];
  streamUrl: string;
  latitude: number | null;
  longitude: number | null;
};

export const RADIO_STATION_COLUMNS =
  "id, property_id, city_label, station_name, stream_url, display_order, is_visible, created_at, call_sign, frequency, band, station_type, latitude, longitude, state_code, timezone";

export const MAX_VISIBLE_STATIONS = 10;

export const RADIO_STATIONS_EVENT = "bumblehub:radio-stations";
export const RADIO_TUNED_ID_KEY = "bumblehub:radio-tuned-id";

export function notifyRadioStationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RADIO_STATIONS_EVENT));
}

export function isHttpsStreamUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeRadioStation(row: RadioStation): RadioStation {
  const rawBand = row.band as string;
  const band = rawBand === "am" || rawBand === "sports" ? "am" : "fm";
  const station_type = row.station_type === "feed" ? "feed" : "stream";
  return {
    ...row,
    band,
    station_type,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    state_code: row.state_code ?? null,
    timezone: row.timezone ?? null,
  };
}
