"use client";

/**
 * The band the dial was last showing, kept across visits.
 *
 * Landing everyone on FM1 would make those four stations look more popular
 * just from being seen first. Play counts stay fair if people come back
 * where they left the selector.
 */

import {
  DEFAULT_FACE_BAND,
  parseRadioBand,
  type RadioFaceBand,
} from "./ranch";

const BAND_KEY = "latigo-radio-band";

function isFaceBand(value: string | null): value is RadioFaceBand {
  if (value === "wx") return true;
  return parseRadioBand(value) != null;
}

export function readLastBand(): RadioFaceBand | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BAND_KEY);
    if (!raw) return null;
    if (raw === "fm") return "fm1";
    return isFaceBand(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeLastBand(band: RadioFaceBand) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BAND_KEY, band);
  } catch {
    // ignore
  }
}

export { DEFAULT_FACE_BAND };
