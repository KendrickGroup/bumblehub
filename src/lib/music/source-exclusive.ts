"use client";

import { useSyncExternalStore } from "react";
import { notifyMusicUpdated } from "./events";
import type { NowPlayingResponse } from "./types";

const VERIFY_MS = 1500;
const TAKEOVER_GRACE_MS = 3000;
const TOAST_MS = 4000;
export const SPOTIFY_TAKEOVER_TOAST = "Spotify took over the music.";

type ExclusiveOwner = "radio" | "spotify";

let generation = 0;
let owner: ExclusiveOwner | null = null;
let claimedAt = 0;

type SpotifySample = {
  fetchedAt: number;
  isPlaying: boolean;
  progressMs: number;
  trackId: string | null;
};

let lastSample: SpotifySample | null = null;
let toast: string | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const toastListeners = new Set<() => void>();

function emitToast() {
  for (const listener of toastListeners) listener();
}

function getToastSnapshot() {
  return toast;
}

function subscribeToast(listener: () => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function useMusicExclusiveToast() {
  return useSyncExternalStore(
    subscribeToast,
    getToastSnapshot,
    getToastSnapshot,
  );
}

export function claimMusicExclusive(next: ExclusiveOwner): number {
  generation += 1;
  owner = next;
  claimedAt = Date.now();
  if (next === "radio") lastSample = null;
  return generation;
}

function sampleFrom(
  state: NowPlayingResponse | null,
  fetchedAt: number,
): SpotifySample {
  if (state?.status === "playing" && state.track.isPlaying) {
    return {
      fetchedAt,
      isPlaying: true,
      progressMs: state.track.progressMs,
      trackId: state.track.id,
    };
  }
  return { fetchedAt, isPlaying: false, progressMs: 0, trackId: null };
}

function logPauseFailure(input: {
  attempt: number;
  httpStatus: number | null;
  error?: string;
  stillPlaying?: boolean;
}) {
  console.info(
    JSON.stringify({
      msg: "music.exclusive.spotify-pause",
      ...input,
    }),
  );
}

function isBenignPauseMiss(status: number, error?: string) {
  if (status === 404) return true;
  const text = (error ?? "").toLowerCase();
  return text.includes("not connected") || text.includes("no_active_device");
}

async function postPause(): Promise<{
  ok: boolean;
  status: number;
  error?: string;
}> {
  try {
    const response = await fetch("/api/music/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "pause" }),
    });
    if (response.ok) return { ok: true, status: response.status };

    let error: string | undefined;
    try {
      const body = (await response.json()) as { error?: string; code?: string };
      error = body.error;
      if (body.code === "NO_ACTIVE_DEVICE" || isBenignPauseMiss(response.status, error)) {
        return { ok: true, status: response.status };
      }
    } catch {
      error = `HTTP ${response.status}`;
    }
    return { ok: false, status: response.status, error };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "pause request failed",
    };
  }
}

async function getNowPlaying(): Promise<NowPlayingResponse | null> {
  try {
    const response = await fetch("/api/music/now-playing", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as NowPlayingResponse;
  } catch {
    return null;
  }
}

function stillClaimed(claimGeneration: number) {
  return claimGeneration === generation && owner === "radio";
}

/**
 * Pause Spotify after radio audio has already been kicked off (do not await
 * this before HTMLAudioElement.play — iOS needs play() in the same gesture).
 * Verifies ~1.5s later and retries pause once if Spotify is still playing.
 */
export async function pauseSpotifyForRadio(claimGeneration: number) {
  const first = await postPause();
  if (!stillClaimed(claimGeneration)) return;
  if (!first.ok) {
    logPauseFailure({
      attempt: 1,
      httpStatus: first.status,
      error: first.error,
    });
  }

  await new Promise((resolve) => setTimeout(resolve, VERIFY_MS));
  if (!stillClaimed(claimGeneration)) return;

  const snapshot = await getNowPlaying();
  if (!stillClaimed(claimGeneration)) return;
  if (!sampleFrom(snapshot, Date.now()).isPlaying) {
    notifyMusicUpdated();
    return;
  }

  const retry = await postPause();
  if (!stillClaimed(claimGeneration)) return;
  if (!retry.ok) {
    logPauseFailure({
      attempt: 2,
      httpStatus: retry.status,
      error: retry.error,
      stillPlaying: true,
    });
  }
  notifyMusicUpdated();
}

export function showSpotifyTakeoverToast() {
  toast = SPOTIFY_TAKEOVER_TOAST;
  emitToast();
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast = null;
    emitToast();
  }, TOAST_MS);
}

/**
 * True when radio is live and a fresh poll shows Spotify actually moving —
 * not a cached/stale is_playing flag from before radio claimed the room.
 */
export function shouldYieldRadioToSpotify(
  state: NowPlayingResponse | null,
  fetchedAt: number,
  radioLive: boolean,
): boolean {
  const current = sampleFrom(state, fetchedAt);

  if (!radioLive) {
    lastSample = current;
    return false;
  }
  if (owner !== "radio") return false;
  if (fetchedAt < claimedAt) return false;
  if (Date.now() - claimedAt < TAKEOVER_GRACE_MS) return false;
  if (!current.isPlaying) {
    lastSample = current;
    return false;
  }

  const prev = lastSample;
  lastSample = current;
  if (!prev || prev.fetchedAt < claimedAt) return false;

  return (
    current.trackId !== prev.trackId || current.progressMs > prev.progressMs
  );
}
