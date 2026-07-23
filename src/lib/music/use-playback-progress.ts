"use client";

import { useEffect, useRef, useState } from "react";
import type { NowPlayingTrack } from "@/lib/music/types";

/**
 * Advances progress_ms locally between polls using wall-clock time while playing.
 * Resyncs whenever the server reports a new progress_ms / track / play state.
 */
export function usePlaybackProgress(track: NowPlayingTrack | null): number {
  const [progressMs, setProgressMs] = useState(track?.progressMs ?? 0);
  const baseProgressRef = useRef(track?.progressMs ?? 0);
  const syncedAtRef = useRef(Date.now());
  const isPlayingRef = useRef(Boolean(track?.isPlaying));
  const durationRef = useRef(track?.durationMs ?? 0);

  useEffect(() => {
    if (!track) {
      baseProgressRef.current = 0;
      syncedAtRef.current = Date.now();
      isPlayingRef.current = false;
      durationRef.current = 0;
      setProgressMs(0);
      return;
    }

    baseProgressRef.current = track.progressMs;
    syncedAtRef.current = Date.now();
    isPlayingRef.current = track.isPlaying;
    durationRef.current = track.durationMs;
    setProgressMs(track.progressMs);
  }, [track?.id, track?.progressMs, track?.isPlaying, track?.durationMs, track]);

  useEffect(() => {
    if (!track?.isPlaying) return;

    const id = window.setInterval(() => {
      const elapsed = Date.now() - syncedAtRef.current;
      const next = Math.min(
        durationRef.current,
        baseProgressRef.current + elapsed,
      );
      setProgressMs(next);
    }, 250);

    return () => window.clearInterval(id);
  }, [track?.id, track?.isPlaying]);

  return progressMs;
}

export function formatTrackTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
