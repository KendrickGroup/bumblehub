import type { LaunchStation } from "./types";

/**
 * West-to-east launch dial. Stream URLs are https-only so they play on a
 * secure house tablet. Editable later in Settings → Radio.
 */
export const LAUNCH_STATIONS: LaunchStation[] = [
  {
    city_label: "Seattle",
    station_name: "KEXP 90.3",
    stream_url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3",
    display_order: 0,
  },
  {
    city_label: "Portland",
    station_name: "KBOO 90.7",
    stream_url: "https://listen.kboo.fm/high",
    display_order: 1,
  },
  {
    city_label: "San Francisco",
    station_name: "KQED",
    stream_url: "https://streams.kqed.org/kqedradio",
    display_order: 2,
  },
  {
    city_label: "Los Angeles",
    station_name: "KCRW",
    stream_url: "https://kcrw.streamguys1.com/kcrw_192k_mp3_on_air",
    display_order: 3,
  },
  {
    city_label: "Austin",
    station_name: "KUTX 98.9",
    stream_url: "https://kut.streamguys1.com/kutx-web",
    display_order: 4,
  },
  {
    city_label: "New Orleans",
    station_name: "WWOZ 90.7",
    stream_url: "https://wwoz-sc.streamguys1.com/wwoz-hi",
    display_order: 5,
  },
  {
    city_label: "Chicago",
    station_name: "WBEZ 91.5",
    stream_url: "https://stream.wbez.org/wbez64-web.aac",
    display_order: 6,
  },
  {
    city_label: "New York",
    station_name: "WNYC 93.9",
    stream_url: "https://fm939.wnyc.org/wnycfm-web",
    display_order: 7,
  },
];
