"use client";

import { usePathname } from "next/navigation";
import { NowPlayingStrip } from "@/components/music/NowPlayingStrip";

export function ShellNowPlaying() {
  const pathname = usePathname();
  // Full now-playing UI lives on /music — strip would duplicate it.
  // Settings is a working desk; keep audio going but hide the player chrome.
  if (
    pathname === "/music" ||
    pathname === "/home" ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  ) {
    return null;
  }

  return <NowPlayingStrip allowConnectPrompt />;
}
