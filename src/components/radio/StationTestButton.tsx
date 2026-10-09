"use client";

import { LoaderCircle, Play, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  useStationTestPlayer,
  type TestPlayerStatus,
} from "@/lib/radio/use-station-test-player";

type Props = {
  testKey: string;
  url: string;
  compact?: boolean;
  failLabel?: string;
  onStatus?: (status: TestPlayerStatus) => void;
};

export function StationTestButton({
  testKey,
  url,
  compact = false,
  failLabel = "Failed to load",
  onStatus,
}: Props) {
  const { status, isActive, play, stop } = useStationTestPlayer(testKey);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    onStatusRef.current?.(status);
  }, [status]);
  const playing = isActive && status === "playing";
  const loading = isActive && status === "loading";
  const failed = isActive && status === "failed";

  const label = playing ? "Stop" : "Test";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        disabled={!url.trim() && !playing && !loading}
        onClick={() => (playing || loading ? stop() : play(url))}
        aria-label={label}
        className={`inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition disabled:opacity-40 ${
          playing || loading
            ? "bg-stone-900 text-white hover:bg-stone-800"
            : "bg-[#F4B400]/20 text-stone-800 hover:bg-[#F4B400]/35"
        } ${compact ? "px-3" : "px-4"}`}
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.25} />
        ) : playing ? (
          <Square className="h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
        ) : (
          <Play className="h-4 w-4" strokeWidth={2.25} fill="currentColor" />
        )}
        {compact ? null : <span>{label}</span>}
      </button>
      {isActive && status !== "idle" ? (
        <span
          className={`truncate text-xs font-medium ${
            failed
              ? "text-red-700"
              : playing
                ? "text-emerald-700"
                : "text-stone-500"
          }`}
        >
          {failed
            ? failLabel
            : playing
              ? "Playing fine"
              : "Connecting…"}
        </span>
      ) : null}
    </div>
  );
}
