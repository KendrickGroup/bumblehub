"use client";

import { useCallback, useSyncExternalStore } from "react";
import { exclusiveRadio, registerRadioStop } from "./audio-exclusive";
import type { RadioStation } from "./types";
import { writeTunedStationId } from "./use-radio-stations";

export type RadioPlayerStatus = "stopped" | "buffering" | "playing" | "failed";

export type RadioPlayerState = {
  status: RadioPlayerStatus;
  stationId: string | null;
  stationName: string | null;
  cityLabel: string | null;
  volume: number;
};

const FAIL_MS = 12000;
const VOLUME_DEFAULT = 0.8;

const listeners = new Set<() => void>();

let audio: HTMLAudioElement | null = null;
let bound = false;
let failTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

let snapshot: RadioPlayerState = {
  status: "stopped",
  stationId: null,
  stationName: null,
  cityLabel: null,
  volume: VOLUME_DEFAULT,
};

function emit(next: RadioPlayerState) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function patch(partial: Partial<RadioPlayerState>) {
  emit({ ...snapshot, ...partial });
}

function clearFailTimer() {
  if (failTimer) {
    clearTimeout(failTimer);
    failTimer = null;
  }
}

function audioHasUrl(el: HTMLAudioElement, url: string): boolean {
  const attr = el.getAttribute("src");
  if (!attr) return false;
  try {
    return el.src === new URL(url, window.location.href).href;
  } catch {
    return el.src === url;
  }
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.volume = snapshot.volume;
  }
  if (!bound) {
    bound = true;
    audio.addEventListener("playing", () => {
      clearFailTimer();
      if (snapshot.status === "stopped") return;
      patch({ status: "playing" });
    });
    audio.addEventListener("waiting", () => {
      if (snapshot.status === "stopped" || snapshot.status === "playing") return;
      patch({ status: "buffering" });
    });
    audio.addEventListener("pause", () => {
      if (snapshot.status === "stopped" || snapshot.status === "failed") return;
      // Setting src pauses the element; play() is already in flight.
      if (snapshot.status === "buffering") return;
      if (audio?.paused) {
        clearFailTimer();
        patch({ status: "stopped" });
      }
    });
    audio.addEventListener("ended", () => {
      stopInternal();
    });
    audio.addEventListener("error", () => {
      if (snapshot.status === "stopped") return;
      clearFailTimer();
      patch({ status: "failed" });
    });
  }
  return audio;
}

function armFailTimer(gen: number) {
  clearFailTimer();
  failTimer = setTimeout(() => {
    if (generation !== gen) return;
    if (snapshot.status === "buffering") {
      audio?.pause();
      patch({ status: "failed" });
    }
  }, FAIL_MS);
}

function stopInternal() {
  generation += 1;
  clearFailTimer();
  if (audio) {
    audio.pause();
  }
  patch({ status: "stopped" });
}

registerRadioStop(stopInternal);

function isLive(): boolean {
  return snapshot.status === "playing" || snapshot.status === "buffering";
}

export function getRadioPlayerState(): RadioPlayerState {
  return snapshot;
}

export function radioIsLive(): boolean {
  return isLive();
}

/**
 * Start (or retune) the house stream. Must be called from a tap handler with
 * no awaits before this function — iOS Safari requires play() in the gesture.
 */
export function playRadio(station: Pick<
  RadioStation,
  "id" | "station_name" | "city_label" | "stream_url"
>) {
  exclusiveRadio();
  const url = station.stream_url.trim();
  if (!url) {
    patch({
      status: "failed",
      stationId: station.id,
      stationName: station.station_name,
      cityLabel: station.city_label,
    });
    writeTunedStationId(station.id);
    return;
  }

  const el = getAudio();
  const gen = ++generation;
  writeTunedStationId(station.id);
  patch({
    status: "buffering",
    stationId: station.id,
    stationName: station.station_name,
    cityLabel: station.city_label,
  });

  if (!audioHasUrl(el, url)) {
    el.src = url;
  }
  el.volume = snapshot.volume;
  const started = el.play();
  if (started !== undefined) {
    void started.catch(() => {
      if (generation !== gen) return;
      patch({ status: "failed" });
    });
  }
  armFailTimer(gen);
}

export function stopRadioPlayback() {
  stopInternal();
}

export function setRadioVolume(volume: number) {
  const next = Math.min(1, Math.max(0, volume));
  if (audio) audio.volume = next;
  patch({ volume: next });
}

export function rememberTunedStation(
  station: Pick<RadioStation, "id" | "station_name" | "city_label">,
) {
  writeTunedStationId(station.id);
  patch({
    stationId: station.id,
    stationName: station.station_name,
    cityLabel: station.city_label,
    status: isLive() ? snapshot.status : "stopped",
  });
}

export function useRadioPlayer(): RadioPlayerState {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getRadioPlayerState,
    getRadioPlayerState,
  );
}

export function useRadioVolume() {
  const state = useRadioPlayer();
  const setVolume = useCallback((volume: number) => {
    setRadioVolume(volume);
  }, []);
  return { volume: state.volume, setVolume };
}
