"use client";

import { AppTabBar } from "./AppTabBar";
import { ShellNowPlaying } from "./ShellNowPlaying";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-[#FAF8F3]">
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-6 pt-2 sm:px-6 sm:pb-8 sm:pt-4">
        {children}
      </main>

      <div className="sticky bottom-0 z-40 shrink-0">
        <ShellNowPlaying />
        <AppTabBar />
      </div>
    </div>
  );
}
