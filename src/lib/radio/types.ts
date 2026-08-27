export type RadioStation = {
  id: string;
  property_id: string;
  city_label: string;
  station_name: string;
  stream_url: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
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
  state: string;
  bitrate: number;
  streamUrl: string;
};

export const RADIO_STATION_COLUMNS =
  "id, property_id, city_label, station_name, stream_url, display_order, is_visible, created_at";

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
