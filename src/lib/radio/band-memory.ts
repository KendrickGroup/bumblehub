"use client";

/**
 * The band the dial was last tuned to, kept across navigations.
 *
 * The Spotify key in the band row leaves the radio page entirely, so
 * RadioDial unmounts and its `browseBand` state goes with it. Without this
 * the dial came back lit on FM no matter where it was left, which is the
 * one thing the band row is supposed to remember — the station id already
 * survives in localStorage (RADIO_TUNED_ID_KEY), so the band was the only
 * half of "where I was" that got lost.
 */

import type { RadioFaceBand } from "./ranch";

const BAND_KEY = "latigo-radio-band";

function isBand(value: string | null): value is RadioFaceBand {
  return value === "fm" || value === "am" || value === "wx";
}

export function readLastBand(): RadioFaceBand | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BAND_KEY);
    return isBand(raw) ? raw : null;
  } catch {
    // Private mode / blocked storage just means no memory.
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
