"use client";

import { useNowPlaying } from "@/lib/music/use-now-playing";
import { useMusicExclusiveToast } from "@/lib/music/source-exclusive";

/**
 * Keeps the Spotify now-playing poll alive on every shell route (including
 * /music, where the strip is hidden) so an outside Spotify start can yield
 * the radio. Renders the takeover toast above the tab bar.
 */
export function MusicSourceGuard() {
  useNowPlaying();
  const message = useMusicExclusiveToast();
  if (!message) return null;

  return (
    <div className="px-4 pb-2 sm:px-6">
      <div
        className="mx-auto max-w-[1200px] rounded-[16px] border border-[#F4B400]/40 bg-[#FBF0D0] px-4 py-3 text-sm font-medium text-stone-900 shadow-sm"
        role="status"
      >
        {message}
      </div>
    </div>
  );
}
