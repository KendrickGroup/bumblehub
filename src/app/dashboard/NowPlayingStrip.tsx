"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { NowPlayingResponse, PlaybackCommand } from "@/lib/music/types";

const POLL_MS = 5000;
const REFRESH_AFTER_COMMAND_MS = 400;

export function NowPlayingStrip() {
  const [state, setState] = useState<NowPlayingResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/music/now-playing", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as NowPlayingResponse;
      setState(body);
    } catch {
      // Keep last known state on transient errors.
    }
  }, []);

  const sendCommand = useCallback(
    async (command: PlaybackCommand["command"]) => {
      setBusy(true);
      try {
        const response = await fetch("/api/music/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        });
        if (!response.ok) return;

        await load();
        window.setTimeout(load, REFRESH_AFTER_COMMAND_MS);
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!state || state.status === "not_connected") {
    return (
      <div className="flex min-h-[72px] items-center gap-4 rounded-[18px] border-2 border-[#F4B400]/30 bg-white px-5 py-4 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F4B400]/15">
          <Music2 className="h-7 w-7 text-[#F4B400]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-stone-500">Now playing</p>
          <p className="text-base font-medium text-stone-800">
            Connect Spotify to see what&apos;s playing
          </p>
        </div>
        <Link
          href="/api/spotify/login"
          className="min-h-[48px] shrink-0 rounded-[18px] bg-[#F4B400] px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800]"
        >
          Connect
        </Link>
      </div>
    );
  }

  const isPlaying = state.status === "playing" && state.track.isPlaying;
  const track = state.status === "playing" ? state.track : null;

  return (
    <div
      className={`flex min-h-[72px] flex-wrap items-center gap-4 rounded-[18px] bg-white px-5 py-4 shadow-sm ${
        isPlaying ? "ring-2 ring-[#F4B400]/40" : ""
      }`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
        {track?.albumArtUrl ? (
          <Image
            src={track.albumArtUrl}
            alt=""
            fill
            className="object-cover"
            sizes="56px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-7 w-7 text-stone-400" strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-stone-500">
          {state.status === "idle"
            ? "Now playing"
            : isPlaying
              ? "Now playing"
              : "Paused"}
        </p>
        <p className="truncate text-base font-semibold text-stone-900">
          {track?.name ?? "Nothing playing"}
        </p>
        {track?.artists && (
          <p className="truncate text-sm text-stone-500">{track.artists}</p>
        )}
      </div>

      <PlaybackControls
        busy={busy}
        isPlaying={isPlaying}
        onPrevious={() => sendCommand("previous")}
        onPlayPause={() => sendCommand(isPlaying ? "pause" : "play")}
        onNext={() => sendCommand("next")}
      />
    </div>
  );
}

function PlaybackControls({
  busy,
  isPlaying,
  onPrevious,
  onPlayPause,
  onNext,
}: {
  busy: boolean;
  isPlaying: boolean;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
}) {
  const disabled = busy;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <ControlButton
        label="Previous"
        disabled={disabled}
        onClick={onPrevious}
        className="text-stone-700 hover:bg-stone-100"
      >
        <SkipBack className="h-6 w-6" strokeWidth={2} />
      </ControlButton>

      <ControlButton
        label={isPlaying ? "Pause" : "Play"}
        disabled={disabled}
        onClick={onPlayPause}
        className={
          isPlaying
            ? "bg-stone-900 text-white hover:bg-stone-800"
            : "bg-[#F4B400] text-stone-900 hover:bg-[#e0a800]"
        }
      >
        {isPlaying ? (
          <Pause className="h-6 w-6" strokeWidth={2} fill="currentColor" />
        ) : (
          <Play className="h-6 w-6" strokeWidth={2} fill="currentColor" />
        )}
      </ControlButton>

      <ControlButton
        label="Next"
        disabled={disabled}
        onClick={onNext}
        className="text-stone-700 hover:bg-stone-100"
      >
        <SkipForward className="h-6 w-6" strokeWidth={2} />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[52px] min-w-[52px] items-center justify-center rounded-[18px] transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
