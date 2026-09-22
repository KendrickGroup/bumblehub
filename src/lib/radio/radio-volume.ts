"use client";

import { useSyncExternalStore } from "react";

const VOLUME_KEY = "latigo-radio-volume";
const GAIN_KEY = "latigo-radio-gain-ok";

export type RadioVolumeOutput = "gain" | "element" | "none";

export type RadioVolumeState = {
  level: number;
  muted: boolean;
  output: RadioVolumeOutput;
};

const listeners = new Set<() => void>();

function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function readStoredLevel(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw == null) return 1;
    const n = clampLevel(Number.parseFloat(raw));
    return n <= 0 ? 1 : n;
  } catch {
    return 1;
  }
}

export function writeStoredLevel(level: number): void {
  if (typeof window === "undefined") return;
  const n = clampLevel(level);
  if (n <= 0) return;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(n));
  } catch {
    // Private mode.
  }
}

type GainCache = Record<string, boolean>;

function readGainMap(): GainCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GAIN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: GainCache = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function readGainSupport(stationId: string): boolean | null {
  const map = readGainMap();
  if (Object.prototype.hasOwnProperty.call(map, stationId)) {
    return map[stationId] === true;
  }
  return null;
}

export function writeGainSupport(stationId: string, ok: boolean): void {
  if (typeof window === "undefined" || !stationId) return;
  try {
    const map = readGainMap();
    map[stationId] = ok;
    window.localStorage.setItem(GAIN_KEY, JSON.stringify(map));
  } catch {
    // Private mode.
  }
}

export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function canShowAirPlayPicker(): boolean {
  if (typeof HTMLMediaElement === "undefined") return false;
  return (
    typeof (
      HTMLMediaElement.prototype as HTMLMediaElement & {
        webkitShowPlaybackTargetPicker?: () => void;
      }
    ).webkitShowPlaybackTargetPicker === "function"
  );
}

export function showAirPlayPicker(el: HTMLMediaElement): boolean {
  const media = el as HTMLMediaElement & {
    webkitShowPlaybackTargetPicker?: () => void;
  };
  if (typeof media.webkitShowPlaybackTargetPicker !== "function") return false;
  try {
    media.webkitShowPlaybackTargetPicker();
    return true;
  } catch {
    return false;
  }
}

export function fallbackOutput(): RadioVolumeOutput {
  return isAppleTouchDevice() ? "none" : "element";
}

/**
 * Server and first client render must agree, so the stored level and the
 * device's fallback output are read after mount (hydrateRadioVolume), never
 * during render — otherwise a saved level of 0.4 hydrates against a 100 slider.
 */
const DEFAULT_STATE: RadioVolumeState = {
  level: 1,
  muted: false,
  output: "element",
};

let snapshot: RadioVolumeState = DEFAULT_STATE;
let hydrated = false;

function emit(next: RadioVolumeState): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getRadioVolumeState(): RadioVolumeState {
  return snapshot;
}

function getServerSnapshot(): RadioVolumeState {
  return DEFAULT_STATE;
}

export function patchRadioVolume(partial: Partial<RadioVolumeState>): void {
  const next: RadioVolumeState = { ...snapshot, ...partial };
  if (
    next.level === snapshot.level &&
    next.muted === snapshot.muted &&
    next.output === snapshot.output
  ) {
    return;
  }
  emit(next);
}

/**
 * Call from an effect. Restores the saved level.
 *
 * Output starts optimistic ("element") so the wall iPad shows a slider before
 * anything plays; it only drops to "none" if a station actually fails the gain
 * path on a device where audio.volume is a no-op.
 */
export function hydrateRadioVolume(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  emit({
    level: readStoredLevel(),
    muted: false,
    output: "element",
  });
}

export function useRadioVolume(): RadioVolumeState {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getRadioVolumeState,
    getServerSnapshot,
  );
}
