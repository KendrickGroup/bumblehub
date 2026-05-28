"use client";

import { useEffect, useState } from "react";
import { ListMusic, Music2 } from "lucide-react";
import type { NowPlayingResponse } from "@/lib/music/types";
import { PlaylistPickerModal } from "./PlaylistPickerModal";

export function MusicTile() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/music/now-playing", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: NowPlayingResponse) => {
        setConnected(body.status !== "not_connected");
      })
      .catch(() => setConnected(false));
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[88px] w-full flex-col items-start justify-between rounded-[20px] border-2 border-transparent bg-white p-5 text-left shadow-sm transition hover:border-[#F4B400]/40"
      >
        <Music2
          className={`h-7 w-7 ${connected ? "text-[#F4B400]" : "text-stone-400"}`}
          strokeWidth={1.75}
        />
        <div className="mt-4">
          <span className="text-lg font-medium text-stone-900">Music</span>
          <p className="text-sm text-stone-500">
            {connected === false
              ? "Connect Spotify"
              : connected
                ? "Pick a playlist"
                : "Playlists"}
          </p>
        </div>
      </button>

      <PlaylistPickerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
