"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

const POLL_MS = 15000;

type Snapshot = {
  url: string | null;
  track: RadioNowPlayingTrack | null;
};

const listeners = new Set<() => void>();
const refs = new Map<string, number>();

let snapshot: Snapshot = { url: null, track: null };
let activeUrl: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(next: Snapshot) {
  if (
    snapshot.url === next.url &&
    snapshot.track?.title === next.track?.title &&
    snapshot.track?.artist === next.track?.artist &&
    snapshot.track?.artworkUrl === next.track?.artworkUrl
  ) {
    return;
  }
  snapshot = next;
  emit();
}

async function load(url: string) {
  try {
    const response = await fetch(
      `/api/radio/now-playing?url=${encodeURIComponent(url)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const body = (await response.json()) as {
      track?: RadioNowPlayingTrack | null;
    };
    if (activeUrl !== url) return;
    setSnapshot({ url, track: body.track ?? null });
  } catch {
    // Keep the last snapshot; a missed poll should not hide a known song.
  }
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  activeUrl = null;
}

function retarget() {
  const next =
    [...refs.entries()].find(([, count]) => count > 0)?.[0] ?? null;
  if (next === activeUrl) return;

  stopPolling();
  if (!next) {
    setSnapshot({ url: null, track: null });
    return;
  }

  activeUrl = next;
  void load(next);
  timer = setInterval(() => {
    if (activeUrl) void load(activeUrl);
  }, POLL_MS);
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot() {
  return snapshot;
}

export function useRadioNowPlaying(
  streamUrl: string | null,
  enabled: boolean,
): RadioNowPlayingTrack | null {
  const url = enabled ? streamUrl : null;

  useEffect(() => {
    if (!url) return;
    refs.set(url, (refs.get(url) ?? 0) + 1);
    retarget();
    return () => {
      const remaining = (refs.get(url) ?? 1) - 1;
      if (remaining <= 0) refs.delete(url);
      else refs.set(url, remaining);
      retarget();
    };
  }, [url]);

  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!url) return null;
  if (current.url !== url) return null;
  return current.track;
}
