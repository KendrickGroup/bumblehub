import type { RadioStation } from "./types";

const CALL_RE = /\b([KW][A-Z]{2,3}(?:-FM)?)\b/i;
const FM_RE = /\b(\d{2,3}\.\d{1,2})\b/;
const AM_RE = /\b(\d{3,4})\b/;

export type StationFace = {
  callSign: string | null;
  frequency: string | null;
  band: "AM" | "FM" | null;
  buttonLabel: string;
  buttonSub: string | null;
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

export function stationFace(
  station: Pick<
    RadioStation,
    "city_label" | "station_name" | "call_sign" | "frequency"
  >,
): StationFace {
  const parsed = parseCallAndFreq(station.station_name);
  const callSign = (station.call_sign ?? "").trim() || parsed.callSign;
  const frequency = (station.frequency ?? "").trim() || parsed.frequency;
  const band = bandFromFrequency(frequency);
  const buttonLabel = callSign || station.city_label || station.station_name;
  return {
    callSign,
    frequency,
    band,
    buttonLabel,
    buttonSub: frequency,
    readoutPrimary: callSign || station.station_name,
    readoutFreq: frequency,
  };
}
