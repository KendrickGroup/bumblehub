"use client";

import { usePathname } from "next/navigation";
import { NowPlayingStrip } from "@/components/music/NowPlayingStrip";

export function ShellNowPlaying() {
  const pathname = usePathname();
  // Full now-playing UI lives on /music — strip would duplicate it.
  if (pathname === "/music" || pathname === "/home") {
    return null;
  }

  return <NowPlayingStrip allowConnectPrompt />;
}
