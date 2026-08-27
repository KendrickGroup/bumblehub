"use client";

import { useEffect, useState } from "react";
import { BUILD_SHA, BUILD_TIME_ISO, formatBuiltLabel } from "@/lib/build-info";

const TICK_MS = 30_000;

function formatLiveClock(now: Date): { time: string; date: string } {
  return {
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now),
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(now),
  };
}

export function BuildStamp() {
  const [now, setNow] = useState<Date | null>(null);
  const built = formatBuiltLabel(BUILD_TIME_ISO);

  useEffect(() => {
    const kick = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, []);

  if (!now) return null;

  const { time, date } = formatLiveClock(now);

  return (
    <p
      aria-hidden
      className="pointer-events-none fixed right-3 z-30 max-w-[calc(100vw-1.5rem)] truncate whitespace-nowrap font-[family-name:var(--font-bricolage)] text-[11px] leading-none tabular-nums select-none"
      style={{
        color: "rgba(122,112,102,.35)",
        bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 8px)",
      }}
    >
      {time}
      <span aria-hidden> · </span>
      {date}
      <span className="hidden sm:inline">
        <span aria-hidden> · </span>
        {BUILD_SHA}
      </span>
      {built ? (
        <>
          <span aria-hidden> · </span>
          {built}
        </>
      ) : null}
    </p>
  );
}
