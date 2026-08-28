"use client";

import { useEffect, useState } from "react";
import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

const POLL_MS = 15000;

export function useRadioNowPlaying(
  streamUrl: string | null,
  enabled: boolean,
): RadioNowPlayingTrack | null {
  const [snapshot, setSnapshot] = useState<{
    url: string;
    track: RadioNowPlayingTrack | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !streamUrl) return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/radio/now-playing?url=${encodeURIComponent(streamUrl)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const body = (await response.json()) as {
          track?: RadioNowPlayingTrack | null;
        };
        if (!cancelled) {
          setSnapshot({ url: streamUrl, track: body.track ?? null });
        }
      } catch {
        // Keep the last snapshot; a missed poll should not hide a known song.
      }
    };

    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, streamUrl]);

  if (!enabled || !streamUrl) return null;
  if (snapshot?.url !== streamUrl) return null;
  return snapshot.track;
}
