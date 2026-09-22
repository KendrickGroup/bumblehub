"use client";

import { useSyncExternalStore } from "react";
import {
  claimMusicExclusive,
  pauseSpotifyForRadio,
} from "@/lib/music/source-exclusive";
import { exclusiveRadio, registerRadioStop } from "./audio-exclusive";
import { noteListening } from "./list-gate";
import { trackPlayerStatus } from "./play-log";
import type { RadioStation } from "./types";
import { writeTunedStationId } from "./use-radio-stations";
import { loadFeedEpisodes, peekFeedEpisodes } from "./feed-cache";
import type { RadioFeedEpisode } from "./feed";
import { pickFeedEpisodeIndex } from "./feed-shuffle";
import {
  fallbackOutput,
  getRadioVolumeState,
  hydrateRadioVolume,
  patchRadioVolume,
  readGainSupport,
  showAirPlayPicker,
  writeGainSupport,
  writeStoredLevel,
} from "./radio-volume";

export type RadioPlayerStatus = "stopped" | "buffering" | "playing" | "failed";

export type RadioPlayerState = {
  status: RadioPlayerStatus;
  stationId: string | null;
  stationName: string | null;
  cityLabel: string | null;
  streamUrl: string | null;
  reconnectAttempt: number;
};

type PlayableStation = Pick<
  RadioStation,
  "id" | "station_name" | "city_label" | "stream_url"
> & {
  station_type?: RadioStation["station_type"];
  /** Carried for the play log; every real dial row already has both. */
  call_sign?: RadioStation["call_sign"];
  band?: RadioStation["band"];
};

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

const FAIL_MS = 12000;
const STALL_MS = 8000;
const RECONNECT_GAP_MS = 5000;
const RECONNECT_MAX = 3;
const ANALYSER_TICK_MS = 400;
// ~5s of real audio before calling the graph tainted. Short windows read a
// still-buffering MP3 as silence and tear down a gain path that works.
const ANALYSER_TICKS = 12;
const ANALYSER_MIN_PLAYED_SEC = 1.5;

const listeners = new Set<() => void>();

let audio: HTMLAudioElement | null = null;
let bound = false;
let failTimer: ReturnType<typeof setTimeout> | null = null;
let stallTimer: ReturnType<typeof setTimeout> | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let analyserTimer: ReturnType<typeof setInterval> | null = null;
let generation = 0;
let tuned: PlayableStation | null = null;
let ignoreErrorUntil = 0;
let lastTimeUpdate = 0;
let attachInFlight = false;
let feedRss: string | null = null;
let feedEpisodes: RadioFeedEpisode[] = [];
let feedUrls: string[] = [];
let feedTitles: string[] = [];
let feedDates: string[] = [];
let feedIndex = 0;
let usingCors = false;
let corsFallbackUsed = false;
let mutePaused = false;

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let gainNode: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;
let graphBoundEl: HTMLAudioElement | null = null;

let snapshot: RadioPlayerState = {
  status: "stopped",
  stationId: null,
  stationName: null,
  cityLabel: null,
  streamUrl: null,
  reconnectAttempt: 0,
};

function emit(next: RadioPlayerState) {
  if (
    snapshot.status === next.status &&
    snapshot.stationId === next.stationId &&
    snapshot.stationName === next.stationName &&
    snapshot.cityLabel === next.cityLabel &&
    snapshot.streamUrl === next.streamUrl &&
    snapshot.reconnectAttempt === next.reconnectAttempt
  ) {
    return;
  }
  snapshot = next;
  // Every status change funnels through here, so the play log sees switches,
  // reconnects and stops without each call site remembering to say so.
  trackPlayerStatus(next, tuned);
  noteListening(next.status === "playing");
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

function clearAnalyserTimer() {
  if (analyserTimer) {
    clearInterval(analyserTimer);
    analyserTimer = null;
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
    pubDate: feedDates[feedIndex] || null,
    index: feedIndex,
    total: feedUrls.length,
  };
}

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  const fromWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? fromWindow.webkitAudioContext ?? null;
}

function resumeAudioContext(): void {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function teardownGraph(): void {
  try {
    sourceNode?.disconnect();
  } catch {
    // Already gone.
  }
  try {
    gainNode?.disconnect();
  } catch {
    // Already gone.
  }
  try {
    analyserNode?.disconnect();
  } catch {
    // Already gone.
  }
  sourceNode = null;
  gainNode = null;
  analyserNode = null;
  graphBoundEl = null;
}

function applyOutputVolume(): void {
  const { level, muted, output } = getRadioVolumeState();
  const gain = muted ? 0 : level;
  if (gainNode && output === "gain") {
    gainNode.gain.value = gain;
  }
  if (audio) {
    audio.volume = output === "element" ? gain : 1;
  }
}

function connectGraph(el: HTMLAudioElement): boolean {
  resumeAudioContext();
  if (!audioCtx) return false;
  if (graphBoundEl === el && sourceNode && gainNode) {
    applyOutputVolume();
    return true;
  }
  if (graphBoundEl && graphBoundEl !== el) {
    teardownGraph();
  }
  try {
    sourceNode = audioCtx.createMediaElementSource(el);
    gainNode = audioCtx.createGain();
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    sourceNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    sourceNode.connect(analyserNode);
    graphBoundEl = el;
    applyOutputVolume();
    return true;
  } catch {
    teardownGraph();
    return false;
  }
}

function analyserHasSignal(): boolean {
  if (!analyserNode) return false;
  const data = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(data);
  let drift = 0;
  for (const sample of data) {
    drift += Math.abs(sample - 128);
  }
  return drift > 24;
}

function armAnalyserProbe(stationId: string, gen: number): void {
  clearAnalyserTimer();
  if (getRadioVolumeState().output !== "gain" || !analyserNode) return;
  if (readGainSupport(stationId) === true) return;
  let ticks = 0;
  analyserTimer = setInterval(() => {
    if (generation !== gen) {
      clearAnalyserTimer();
      return;
    }
    if (snapshot.status !== "playing") return;
    if ((audio?.currentTime ?? 0) < ANALYSER_MIN_PLAYED_SEC) return;
    ticks += 1;
    if (analyserHasSignal()) {
      writeGainSupport(stationId, true);
      clearAnalyserTimer();
      return;
    }
    if (ticks >= ANALYSER_TICKS) {
      clearAnalyserTimer();
      writeGainSupport(stationId, false);
      fallbackFromTaint(gen);
    }
  }, ANALYSER_TICK_MS);
}

function cacheBust(url: string): string {
  if (feedRss) return url;
  return `${url}${url.includes("?") ? "&" : "?"}_bh=${Date.now()}`;
}

function recycleAudioForPolicy(wantGraph: boolean): HTMLAudioElement {
  if (audio && graphBoundEl === audio && !wantGraph) {
    releaseAudioElement();
  }
  const el = getAudio();
  if (wantGraph) {
    el.crossOrigin = "anonymous";
  } else {
    el.removeAttribute("crossOrigin");
  }
  return el;
}

function startElement(
  el: HTMLAudioElement,
  url: string,
  gen: number,
  onFail: "failed" | "reconnect",
): void {
  attachInFlight = true;
  if (!audioHasUrl(el, url)) {
    el.src = cacheBust(url);
  }
  applyOutputVolume();
  const started = el.play();
  if (started !== undefined) {
    void started.catch(() => {
      if (generation !== gen) return;
      attachInFlight = false;
      if (maybeFallbackFromCors(gen, url)) return;
      if (onFail === "reconnect") {
        startReconnect();
        return;
      }
      patch({ status: "failed" });
    });
  }
}

function maybeFallbackFromCors(gen: number, url: string): boolean {
  if (generation !== gen) return false;
  if (!usingCors || corsFallbackUsed || !tuned || !url) return false;
  usingCors = false;
  corsFallbackUsed = true;
  writeGainSupport(tuned.id, false);
  patchRadioVolume({ output: fallbackOutput() });
  const el = recycleAudioForPolicy(false);
  startElement(el, url, gen, "failed");
  return true;
}

function fallbackFromTaint(gen: number): void {
  if (generation !== gen || !tuned) return;
  const url = currentPlayUrl();
  if (!url) return;
  usingCors = false;
  corsFallbackUsed = true;
  patchRadioVolume({ output: fallbackOutput() });
  const el = recycleAudioForPolicy(false);
  patch({ status: "buffering" });
  startElement(el, url, gen, "failed");
}

function beginPlayback(
  url: string,
  gen: number,
  tryGain: boolean,
  onFail: "failed" | "reconnect",
): void {
  usingCors = tryGain;
  corsFallbackUsed = !tryGain;
  const el = recycleAudioForPolicy(tryGain);
  if (tryGain) {
    if (connectGraph(el)) {
      patchRadioVolume({ output: "gain" });
    } else {
      if (tuned) writeGainSupport(tuned.id, false);
      usingCors = false;
      corsFallbackUsed = true;
      patchRadioVolume({ output: fallbackOutput() });
      return beginPlayback(url, gen, false, onFail);
    }
  } else {
    patchRadioVolume({ output: fallbackOutput() });
  }
  startElement(el, url, gen, onFail);
  if (tryGain && tuned && getRadioVolumeState().output === "gain") {
    armAnalyserProbe(tuned.id, gen);
  }
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    // Live Icecast/HTTP streams buffer what the UA allows; auto lets
    // Chrome/Safari keep a longer network cushion than preload=none.
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("x-webkit-airplay", "allow");
    applyOutputVolume();
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
      if (mutePaused) return;
      if (snapshot.status === "stopped" || snapshot.status === "failed") return;
      if (snapshot.status === "buffering") return;
      if (snapshot.reconnectAttempt > 0) return;
      if (audio?.paused) {
        clearFailTimer();
        patch({ status: "stopped", reconnectAttempt: 0 });
      }
    });
    audio.addEventListener("ended", () => {
      if (feedRss && feedEpisodes.length > 0 && tuned) {
        loadFeed(tuned.id, feedEpisodes, currentPlayUrl());
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
      const url = currentPlayUrl();
      if (url && maybeFallbackFromCors(generation, url)) return;
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
  const gen = ++generation;
  const raw = currentPlayUrl() || station.stream_url.trim();
  attachInFlight = true;
  patch({
    status: "buffering",
    streamUrl: raw,
  });
  const tryGain = readGainSupport(station.id) !== false;
  beginPlayback(raw, gen, tryGain, "reconnect");
  armFailTimer(gen);
  armWatchdog(gen);
  void pauseSpotifyForRadio(claim);
}

function stopInternal() {
  generation += 1;
  attachInFlight = false;
  mutePaused = false;
  usingCors = false;
  corsFallbackUsed = false;
  clearFailTimer();
  clearStallTimer();
  clearWatchdog();
  clearReconnectTimer();
  clearAnalyserTimer();
  if (audio) {
    detachSource(audio);
  }
  feedRss = null;
  feedEpisodes = [];
  feedUrls = [];
  feedTitles = [];
  feedDates = [];
  feedIndex = 0;
  patchRadioVolume({ muted: false });
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

function loadFeed(
  stationId: string,
  episodes: RadioFeedEpisode[],
  currentUrl?: string | null,
) {
  feedEpisodes = episodes;
  feedUrls = episodes.map((episode) => episode.audioUrl);
  feedTitles = episodes.map((episode) => episode.title);
  feedDates = episodes.map((episode) => episode.pubDate ?? "");
  feedIndex = pickFeedEpisodeIndex(stationId, episodes, currentUrl);
}

/**
 * Start (or retune) the house stream. Must be called from a tap handler with
 * no awaits before this function — iOS Safari requires play() in the gesture.
 */
export function playRadio(station: PlayableStation) {
  exclusiveRadio();
  hydrateRadioVolume();
  resumeAudioContext();
  mutePaused = false;
  patchRadioVolume({ muted: false });
  const claim = claimMusicExclusive("radio");
  tuned = station;
  writeTunedStationId(station.id);

  const isFeed = station.station_type === "feed";
  if (isFeed) {
    feedRss = station.stream_url.trim();
    const cached = peekFeedEpisodes(feedRss) ?? [];
    if (cached.length > 0) {
      loadFeed(station.id, cached);
    } else {
      feedEpisodes = [];
      feedUrls = [];
      feedTitles = [];
      feedDates = [];
      feedIndex = 0;
    }
  } else {
    feedRss = null;
    feedEpisodes = [];
    feedUrls = [];
    feedTitles = [];
    feedDates = [];
    feedIndex = 0;
  }

  const url = isFeed ? feedUrls[feedIndex] ?? "" : station.stream_url.trim();
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

  const gen = ++generation;
  attachInFlight = true;
  clearReconnectTimer();
  clearStallTimer();
  clearAnalyserTimer();
  patch({
    status: "buffering",
    stationId: station.id,
    stationName: station.station_name,
    cityLabel: station.city_label,
    streamUrl: url || station.stream_url,
    reconnectAttempt: 0,
  });

  const tryGain = readGainSupport(station.id) !== false;

  if (isFeed && !url) {
    const el = recycleAudioForPolicy(false);
    el.src = SILENT_WAV;
    applyOutputVolume();
    void el.play()?.catch(() => {});
    const rss = feedRss;
    void loadFeedEpisodes(station.stream_url).then((episodes) => {
      if (generation !== gen) return;
      if (!rss || feedRss !== rss) return;
      loadFeed(station.id, episodes);
      const next = feedUrls[feedIndex];
      if (!next) {
        attachInFlight = false;
        patch({ status: "failed" });
        return;
      }
      beginPlayback(next, gen, tryGain, "failed");
    });
    armFailTimer(gen);
    armWatchdog(gen);
    void pauseSpotifyForRadio(claim);
    return;
  }

  beginPlayback(url, gen, tryGain, "failed");
  armFailTimer(gen);
  armWatchdog(gen);
  void pauseSpotifyForRadio(claim);
}

export function setRadioVolume(level: number): void {
  const n = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 1;
  if (n <= 0.001) {
    patchRadioVolume({ muted: true });
    applyOutputVolume();
    return;
  }
  writeStoredLevel(n);
  patchRadioVolume({ level: n, muted: false });
  applyOutputVolume();
}

export function toggleRadioMute(): void {
  const { muted, output } = getRadioVolumeState();
  const next = !muted;
  if (output === "none") {
    mutePaused = next;
    patchRadioVolume({ muted: next });
    if (next) {
      audio?.pause();
    } else if (snapshot.status === "stopped" || snapshot.status === "failed") {
      mutePaused = false;
    } else {
      void audio?.play()?.catch(() => {});
    }
    return;
  }
  mutePaused = false;
  patchRadioVolume({ muted: next });
  applyOutputVolume();
}

export function showRadioAirPlayPicker(): void {
  const el = audio ?? getAudio();
  showAirPlayPicker(el);
}

export function stopRadioPlayback() {
  stopInternal();
}

/**
 * Wipe the lock-screen card. stopInternal() ends the audio, but iOS and
 * Android keep showing whatever MediaMetadata was set last — so leaving the
 * radio left the station sitting on the lock screen with a dead play button
 * behind it. Metadata null plus playbackState "none" is what clears the card;
 * the handlers go too so the OS buttons cannot call back into a radio the
 * user has walked away from.
 */
export function clearRadioMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return;
  }
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.setActionHandler("play", null);
    navigator.mediaSession.setActionHandler("pause", null);
    navigator.mediaSession.setActionHandler("stop", null);
  } catch {
    // Older iOS rejects some of these; a partial clear is still a clear.
  }
}

/**
 * Hand the audio session back to the OS.
 *
 * stopInternal() detaches the source, which stops the sound, but the
 * HTMLAudioElement lives on in module scope and iOS keeps the audio session
 * open behind it — the transport stays warm and the app keeps "holding" audio
 * after the radio is gone. Dropping the element (and the bound flag, so the
 * listeners re-attach) is what actually releases it. getAudio() builds a fresh
 * one the next time something plays.
 */
function releaseAudioElement() {
  teardownGraph();
  if (audio) {
    detachSource(audio);
    audio = null;
  }
  bound = false;
}

/**
 * Leave the radio for Spotify: stop the stream, clear the lock screen, and
 * release the audio element. Not a pause — nothing is left buffering, and the
 * player returns as "stopped" so the dial comes back with a play button rather
 * than a stop glyph.
 */
export function stopRadioForSpotifyPlayback() {
  claimMusicExclusive("spotify");
  stopInternal();
  clearRadioMediaSession();
  releaseAudioElement();
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
