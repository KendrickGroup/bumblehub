"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { HomeButton } from "./HomeButton";
import { IdleDriftWatcher } from "./IdleDriftWatcher";
import { MusicSourceGuard } from "@/components/music/MusicSourceGuard";
import { ShellNowPlaying } from "./ShellNowPlaying";

function isCookModePath(pathname: string): boolean {
  return /^\/recipes\/(?!new$)[^/]+$/.test(pathname);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/hive/slideshow");
  const onHome = pathname === "/home";
  const onMusic = pathname === "/music";
  // Both the radio cabinet and the Spotify player carry their own close X,
  // so the floating Home chip is replaced on this route rather than shown
  // alongside it. Path between the two faces is Home.
  const hideHomeChip =
    onHome || immersive || isCookModePath(pathname) || onMusic;
  const homeVariant =
    pathname === "/music" || pathname.startsWith("/music/")
      ? "leather"
      : "cream";

  if (immersive) {
    return (
      <>
        <Suspense fallback={null}>
          <IdleDriftWatcher />
        </Suspense>
        <div className="min-h-full bg-[#141210]">{children}</div>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <IdleDriftWatcher />
      </Suspense>

      <div className="flex h-dvh flex-col overflow-hidden bg-[#FAF8F3]">
        {hideHomeChip ? null : (
          <div className="z-30 shrink-0 px-4 pt-[max(10px,env(safe-area-inset-top))] pb-1 sm:px-6">
            <HomeButton variant={homeVariant} />
          </div>
        )}

        <main
          className={`mx-auto min-h-0 w-full max-w-[1200px] flex-1 overscroll-y-contain px-4 pb-6 sm:px-6 sm:pb-8 ${
            onHome
              ? "flex flex-col overflow-hidden pt-2 max-[479px]:overflow-y-auto"
              : "overflow-y-auto"
          } ${
            onMusic
              ? "max-sm:px-2 max-sm:pb-2 max-sm:pt-[max(8px,env(safe-area-inset-top))] sm:pt-3"
              : hideHomeChip
                ? "pt-[max(8px,env(safe-area-inset-top))] sm:pt-4"
                : "pt-2 sm:pt-3"
          }`}
        >
          {children}
        </main>

        <div className="z-40 shrink-0">
          <MusicSourceGuard />
          <ShellNowPlaying />
        </div>
      </div>
    </>
  );
}
