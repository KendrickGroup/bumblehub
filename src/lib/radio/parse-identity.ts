import type { RadioStation } from "./types";

const CALL_RE = /\b([KW][A-Z]{2,3}(?:-FM)?)\b/i;
const FM_RE = /\b(\d{2,3}\.\d{1,2})\b/;
const AM_RE = /\b(\d{3,4})\b/;

export type StationFace = {
  callSign: string | null;
  frequency: string | null;
  band: "AM" | "FM" | null;
  buttonLabel: string;
  buttonSub: string;
  readoutPrimary: string;
  readoutFreq: string | null;
};

export function parseCallAndFreq(name: string): {
  callSign: string | null;
  frequency: string | null;
} {
  const callMatch = name.match(CALL_RE);
  const callSign = callMatch?.[1] ? callMatch[1].toUpperCase() : null;
  const fm = name.match(FM_RE);
  if (fm?.[1]) return { callSign, frequency: fm[1] };
  const withoutCall = callSign
    ? name.replace(new RegExp(callSign, "i"), " ")
    : name;
  const am = withoutCall.match(AM_RE);
  if (am?.[1]) {
    const n = Number(am[1]);
    if (n >= 530 && n <= 1700) return { callSign, frequency: am[1] };
  }
  return { callSign, frequency: null };
}

export function bandFromFrequency(frequency: string | null): "AM" | "FM" | null {
  if (!frequency) return null;
  if (frequency.includes(".")) return "FM";
  const n = Number(frequency);
  if (Number.isFinite(n) && n >= 530 && n <= 1700) return "AM";
  if (Number.isFinite(n) && n >= 87 && n <= 108) return "FM";
  return null;
}

/** Slogan from the NAME field, or null when it's empty / just the call sign. */
export function stationTagline(
  station:
    | Pick<RadioStation, "station_name" | "call_sign" | "frequency">
    | null
    | undefined,
): string | null {
  if (!station) return null;
  const name = station.station_name.trim();
  if (!name) return null;
  const parsed = parseCallAndFreq(name);
  const call = (station.call_sign ?? "").trim() || parsed.callSign || "";
  const freq = (station.frequency ?? "").trim() || parsed.frequency || "";
  const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const folded = fold(name);
  if (call && folded === fold(call)) return null;
  if (call && freq && folded === fold(`${call}${freq}`)) return null;
  let rest = name;
  if (parsed.callSign) {
    rest = rest.replace(new RegExp(parsed.callSign, "i"), " ");
  }
  if (parsed.frequency) rest = rest.replace(parsed.frequency, " ");
  rest = rest.replace(/[-–—|/]/g, " ").replace(/\s+/g, " ").trim();
  if (!rest || /^(am|fm)$/i.test(rest)) return null;
  return name;
}

const REAL_CALL = /^[KW][A-Z]{2,3}(?:-FM)?$/i;

export const DIAL_LABEL_MAX = 10;

/** Small line under a preset key: a real call sign, a network, or a source tag. */
export function presetSourceLine(
  station: Pick<RadioStation, "station_name" | "call_sign"> & {
    station_type?: string | null;
  },
): string {
  const name = station.station_name.trim();
  const call = (station.call_sign ?? "").trim();
  if (
    station.station_type === "feed" ||
    /^classic baseball$/i.test(name) ||
    /^baseball$/i.test(call)
  ) {
    return "ARCHIVE";
  }
  if (REAL_CALL.test(call)) return call.toUpperCase();
  const parsed = parseCallAndFreq(name).callSign;
  if (parsed && REAL_CALL.test(parsed)) return parsed.toUpperCase();
  const network = name.match(/^(\d+\.[A-Za-z]+)/);
  if (network?.[1]) return network[1].toUpperCase();
  return "ONLINE";
}

/** Preset key text. Call sign first, otherwise the station name, clipped. */
export function defaultDialLabel(
  callSign: string | null | undefined,
  name: string | null | undefined,
): string {
  const source = (callSign ?? "").trim() || (name ?? "").trim();
  return source.slice(0, DIAL_LABEL_MAX);
}

export function stationFace(
  station: Pick<
    RadioStation,
    "city_label" | "station_name" | "call_sign" | "frequency"
  > & { dial_label?: string | null; station_type?: string | null },
): StationFace {
  const parsed = parseCallAndFreq(station.station_name);
  const callSign = (station.call_sign ?? "").trim() || parsed.callSign;
  const frequency = (station.frequency ?? "").trim() || parsed.frequency;
  const band = bandFromFrequency(frequency);
  const buttonLabel =
    (station.dial_label ?? "").trim() ||
    defaultDialLabel(callSign, station.station_name) ||
    station.city_label ||
    station.station_name;
  return {
    callSign,
    frequency,
    band,
    buttonLabel,
    buttonSub: presetSourceLine(station),
    readoutPrimary: callSign || station.station_name,
    readoutFreq: frequency,
  };
}
