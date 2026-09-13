"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  claimMusicExclusive,
  pauseSpotifyForRadio,
} from "@/lib/music/source-exclusive";
import { exclusiveRadio, registerRadioStop } from "./audio-exclusive";
import type { RadioStation } from "./types";
import { writeTunedStationId } from "./use-radio-stations";
import { loadFeedEpisodes, peekFeedEpisodes } from "./feed-cache";

export type RadioPlayerStatus = "stopped" | "buffering" | "playing" | "failed";

export type RadioPlayerState = {
  status: RadioPlayerStatus;
  stationId: string | null;
  stationName: string | null;
  cityLabel: string | null;
  streamUrl: string | null;
  volume: number;
  reconnectAttempt: number;
};

type PlayableStation = Pick<
  RadioStation,
  "id" | "station_name" | "city_label" | "stream_url"
> & {
  station_type?: RadioStation["station_type"];
};

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

const FAIL_MS = 12000;
const STALL_MS = 8000;
const RECONNECT_GAP_MS = 5000;
const RECONNECT_MAX = 3;
const VOLUME_DEFAULT = 0.8;

const listeners = new Set<() => void>();

let audio: HTMLAudioElement | null = null;
let bound = false;
let failTimer: ReturnType<typeof setTimeout> | null = null;
let stallTimer: ReturnType<typeof setTimeout> | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
let tuned: PlayableStation | null = null;
let ignoreErrorUntil = 0;
let lastTimeUpdate = 0;
let attachInFlight = false;
let feedRss: string | null = null;
let feedUrls: string[] = [];
let feedTitles: string[] = [];
let feedDates: string[] = [];
let feedIndex = 0;

let snapshot: RadioPlayerState = {
  status: "stopped",
  stationId: null,
  stationName: null,
  cityLabel: null,
  streamUrl: null,
  volume: VOLUME_DEFAULT,
  reconnectAttempt: 0,
};

function emit(next: RadioPlayerState) {
  if (
    snapshot.status === next.status &&
    snapshot.stationId === next.stationId &&
    snapshot.stationName === next.stationName &&
    snapshot.cityLabel === next.cityLabel &&
    snapshot.streamUrl === next.streamUrl &&
    snapshot.volume === next.volume &&
    snapshot.reconnectAttempt === next.reconnectAttempt
  ) {
    return;
  }
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

function clearStallTimer() {
  if (stallTimer) {
    clearTimeout(stallTimer);
    stallTimer = null;
  }
}

function clearWatchdog() {
  if (watchdog) {
    clearInterval(watchdog);
    watchdog = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
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

function detachSource(el: HTMLAudioElement) {
  ignoreErrorUntil = Date.now() + 400;
  el.pause();
  el.removeAttribute("src");
  el.load();
}

function currentPlayUrl(): string {
  if (feedRss && feedUrls[feedIndex]) return feedUrls[feedIndex]!;
  return tuned?.stream_url.trim() ?? "";
}

export function getRadioFeedNow(): {
  title: string;
  pubDate: string | null;
  index: number;
  total: number;
} | null {
  if (!feedRss || feedUrls.length === 0) return null;
  return {
    title: feedTitles[feedIndex] ?? "From the Archive",
    pubDate: feedDates[feedIndex] ?? null,
    index: feedIndex,
    total: feedUrls.length,
  };
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    // Live Icecast/HTTP streams buffer what the UA allows; auto lets
    // Chrome/Safari keep a longer network cushion than preload=none.
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.volume = snapshot.volume;
  }
  if (!bound) {
    bound = true;
    audio.addEventListener("playing", () => {
      clearFailTimer();
      clearStallTimer();
      attachInFlight = false;
      lastTimeUpdate = Date.now();
      if (snapshot.status === "stopped") return;
      patch({ status: "playing", reconnectAttempt: 0 });
    });
    audio.addEventListener("waiting", () => {
      if (snapshot.status === "stopped") return;
      if (snapshot.status === "playing") {
        armStallTimer();
        return;
      }
      patch({ status: "buffering" });
    });
    audio.addEventListener("stalled", () => {
      if (snapshot.status === "playing") armStallTimer();
    });
    audio.addEventListener("timeupdate", () => {
      lastTimeUpdate = Date.now();
      if (snapshot.status === "playing") clearStallTimer();
    });
    audio.addEventListener("pause", () => {
      if (snapshot.status === "stopped" || snapshot.status === "failed") return;
      if (snapshot.status === "buffering") return;
      if (snapshot.reconnectAttempt > 0) return;
      if (audio?.paused) {
        clearFailTimer();
        patch({ status: "stopped", reconnectAttempt: 0 });
      }
    });
    audio.addEventListener("ended", () => {
      if (feedRss && feedIndex + 1 < feedUrls.length && tuned) {
        feedIndex += 1;
        reattach(tuned);
        return;
      }
      if (feedRss) {
        stopInternal();
        return;
      }
      if (snapshot.status === "playing") {
        startReconnect();
        return;
      }
      stopInternal();
    });
    audio.addEventListener("error", () => {
      if (snapshot.status === "stopped") return;
      if (Date.now() < ignoreErrorUntil) return;
      attachInFlight = false;
      if (snapshot.reconnectAttempt > 0) {
        startReconnect();
        return;
      }
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
    if (snapshot.reconnectAttempt > 0) {
      attachInFlight = false;
      startReconnect();
      return;
    }
    if (snapshot.status === "buffering") {
      attachInFlight = false;
      audio?.pause();
      patch({ status: "failed" });
    }
  }, FAIL_MS);
}

function armStallTimer() {
  if (stallTimer || snapshot.reconnectAttempt > 0) return;
  stallTimer = setTimeout(() => {
    stallTimer = null;
    if (snapshot.status === "playing") startReconnect();
  }, STALL_MS);
}

function armWatchdog(gen: number) {
  clearWatchdog();
  lastTimeUpdate = Date.now();
  watchdog = setInterval(() => {
    if (generation !== gen) return;
    if (snapshot.status !== "playing") return;
    if (snapshot.reconnectAttempt > 0) return;
    if (Date.now() - lastTimeUpdate > STALL_MS) {
      startReconnect();
    }
  }, 2000);
}

function startReconnect() {
  if (!tuned) {
    patch({ status: "failed", reconnectAttempt: 0 });
    return;
  }
  if (snapshot.status === "stopped") return;
  if (reconnectTimer || attachInFlight) return;

  const nextAttempt = snapshot.reconnectAttempt + 1;
  if (nextAttempt > RECONNECT_MAX) {
    clearFailTimer();
    clearStallTimer();
    clearWatchdog();
    if (audio) detachSource(audio);
    patch({ status: "failed", reconnectAttempt: 0 });
    return;
  }

  clearStallTimer();
  clearFailTimer();
  patch({ status: "buffering", reconnectAttempt: nextAttempt });

  const delay = nextAttempt === 1 ? 0 : RECONNECT_GAP_MS;
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    if (!tuned) return;
    if (snapshot.status === "stopped") return;
    reattach(tuned);
  }, delay);
}

function reattach(station: PlayableStation) {
  const claim = claimMusicExclusive("radio");
  const el = getAudio();
  const gen = ++generation;
  const raw = currentPlayUrl() || station.stream_url.trim();
  attachInFlight = true;
  detachSource(el);
  patch({
    status: "buffering",
    streamUrl: raw,
  });
  el.src = feedRss ? raw : `${raw}${raw.includes("?") ? "&" : "?"}_bh=${Date.now()}`;
  el.volume = snapshot.volume;
  const started = el.play();
  if (started !== undefined) {
    void started.catch(() => {
      if (generation !== gen) return;
      attachInFlight = false;
      startReconnect();
    });
  }
  armFailTimer(gen);
  armWatchdog(gen);
  void pauseSpotifyForRadio(claim);
}

function stopInternal() {
  generation += 1;
  attachInFlight = false;
  clearFailTimer();
  clearStallTimer();
  clearWatchdog();
  clearReconnectTimer();
  if (audio) {
    detachSource(audio);
  }
  feedRss = null;
  feedUrls = [];
  feedTitles = [];
  feedDates = [];
  feedIndex = 0;
  patch({ status: "stopped", reconnectAttempt: 0 });
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
export function playRadio(station: PlayableStation) {
  exclusiveRadio();
  const claim = claimMusicExclusive("radio");
  tuned = station;
  writeTunedStationId(station.id);

  const isFeed = station.station_type === "feed";
  if (isFeed) {
    feedRss = station.stream_url.trim();
    const cached = peekFeedEpisodes(feedRss) ?? [];
    feedUrls = cached.map((e) => e.audioUrl);
    feedTitles = cached.map((e) => e.title);
    feedDates = cached.map((e) => e.pubDate ?? "");
    feedIndex = 0;
  } else {
    feedRss = null;
    feedUrls = [];
    feedTitles = [];
    feedDates = [];
    feedIndex = 0;
  }

  const url = isFeed ? feedUrls[0] ?? "" : station.stream_url.trim();
  tuned = station;
  writeTunedStationId(station.id);

  if (!url && !isFeed) {
    patch({
      status: "failed",
      stationId: station.id,
      stationName: station.station_name,
      cityLabel: station.city_label,
      streamUrl: null,
      reconnectAttempt: 0,
    });
    return;
  }

  const el = getAudio();
  const gen = ++generation;
  attachInFlight = true;
  clearReconnectTimer();
  clearStallTimer();
  patch({
    status: "buffering",
    stationId: station.id,
    stationName: station.station_name,
    cityLabel: station.city_label,
    streamUrl: url || station.stream_url,
    reconnectAttempt: 0,
  });

  if (isFeed && !url) {
    el.src = SILENT_WAV;
    el.volume = snapshot.volume;
    void el.play()?.catch(() => {});
    const rss = feedRss;
    void loadFeedEpisodes(station.stream_url).then((episodes) => {
      if (generation !== gen) return;
      if (!rss || feedRss !== rss) return;
      feedUrls = episodes.map((e) => e.audioUrl);
      feedTitles = episodes.map((e) => e.title);
      feedDates = episodes.map((e) => e.pubDate ?? "");
      feedIndex = 0;
      const next = feedUrls[0];
      if (!next) {
        attachInFlight = false;
        patch({ status: "failed" });
        return;
      }
      el.src = next;
      void el.play()?.catch(() => {
        if (generation !== gen) return;
        attachInFlight = false;
        patch({ status: "failed" });
      });
    });
    armFailTimer(gen);
    armWatchdog(gen);
    void pauseSpotifyForRadio(claim);
    return;
  }

  if (!audioHasUrl(el, url)) {
    el.src = url;
  }
  el.volume = snapshot.volume;
  const started = el.play();
  if (started !== undefined) {
    void started.catch(() => {
      if (generation !== gen) return;
      attachInFlight = false;
      patch({ status: "failed" });
    });
  }
  armFailTimer(gen);
  armWatchdog(gen);
  void pauseSpotifyForRadio(claim);
}

export function stopRadioPlayback() {
  stopInternal();
}

/** Tear down the house stream before BumbleHub starts Spotify. */
export function stopRadioForSpotifyPlayback() {
  claimMusicExclusive("spotify");
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
