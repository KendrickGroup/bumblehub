"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppTabBar } from "./AppTabBar";
import { BuildStamp } from "./BuildStamp";
import { IdleDriftWatcher } from "./IdleDriftWatcher";
import { MusicSourceGuard } from "@/components/music/MusicSourceGuard";
import { ShellNowPlaying } from "./ShellNowPlaying";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/hive/slideshow");

  return (
    <>
      <Suspense fallback={null}>
        <IdleDriftWatcher />
      </Suspense>

      {immersive ? (
        <div className="min-h-full bg-[#141210]">{children}</div>
      ) : (
        <div className="flex h-dvh flex-col overflow-hidden bg-[#FAF8F3]">
          <main className="mx-auto min-h-0 w-full max-w-[1200px] flex-1 overflow-y-auto overscroll-y-contain px-4 pb-6 pt-2 sm:px-6 sm:pb-8 sm:pt-4">
            {children}
          </main>

          <div className="z-40 shrink-0">
            <MusicSourceGuard />
            <ShellNowPlaying />
            <AppTabBar />
          </div>
          <BuildStamp />
        </div>
      )}
    </>
  );
}
