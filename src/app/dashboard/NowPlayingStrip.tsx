"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import type { NowPlayingResponse } from "@/lib/music/types";

const POLL_MS = 5000;

export function NowPlayingStrip() {
  const [state, setState] = useState<NowPlayingResponse | null>(null);

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

  if (state.status === "idle") {
    return (
      <div className="flex min-h-[72px] items-center gap-4 rounded-[18px] bg-white px-5 py-4 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-100">
          <Music2 className="h-7 w-7 text-stone-400" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-stone-500">Now playing</p>
          <p className="truncate text-base font-medium text-stone-800">
            Nothing playing
          </p>
        </div>
      </div>
    );
  }

  const { track } = state;

  return (
    <div className="flex min-h-[72px] items-center gap-4 rounded-[18px] bg-white px-5 py-4 shadow-sm ring-2 ring-[#F4B400]/40">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
        {track.albumArtUrl ? (
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
            <Music2 className="h-7 w-7 text-[#F4B400]" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#F4B400]">
          {track.isPlaying ? "Now playing" : "Paused"}
        </p>
        <p className="truncate text-base font-semibold text-stone-900">
          {track.name}
        </p>
        <p className="truncate text-sm text-stone-500">{track.artists}</p>
      </div>
    </div>
  );
}
