"use client";

import { usePathname } from "next/navigation";
import { NowPlayingStrip } from "@/components/music/NowPlayingStrip";

export function ShellNowPlaying() {
  const pathname = usePathname();
  const showConnectOnHome = pathname === "/home";

  return <NowPlayingStrip allowConnectPrompt={showConnectOnHome} />;
}
