"use client";

import { usePathname } from "next/navigation";
import { NowPlayingStrip } from "@/components/music/NowPlayingStrip";

export function ShellNowPlaying() {
  const pathname = usePathname();
  // Full now-playing UI lives on /music — strip would duplicate it.
  // Settings is a working desk; keep audio going but hide the player chrome.
  // The portrait parlor needs the camera and scene row; hide the strip there
  // only. Playback continues, and other routes still show the player.
  if (
    pathname === "/music" ||
    pathname === "/home" ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/hive"
  ) {
    return null;
  }

  return <NowPlayingStrip allowConnectPrompt />;
}
