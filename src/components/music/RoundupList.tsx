"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { SpotifyMark } from "@/components/music/AudioSourceMarks";
import type { RopedSong } from "@/lib/roundup/types";

function formatRopedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function ropeLine(song: RopedSong): string {
  const station = song.station_name?.trim() || "the dial";
  return `roped off ${station} · ${formatRopedDate(song.created_at)}`;
}

export function RoundupList({
  songs,
  isOwner,
}: {
  songs: RopedSong[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const onRemove = async (song: RopedSong) => {
    if (
      !window.confirm(
        `Remove "${song.title}" from The Roundup?`,
      )
    ) {
      return;
    }
    setRemovingId(song.id);
    try {
      const response = await fetch(`/api/roundup/${song.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        window.alert(body?.error ?? "Could not remove this song.");
        return;
      }
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  };

  if (songs.length === 0) {
    return (
      <p className="mt-10 text-center font-[family-name:var(--font-elite)] text-[#6B5636]">
        Nothing roped yet. Lasso a song from Ranch House Radio.
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {songs.map((song) => (
        <li
          key={song.id}
          className="flex items-center gap-3 rounded-[16px] border border-[#33241A]/15 bg-[#FFF8EA] px-3 py-3 shadow-[0_3px_10px_rgba(44,29,20,.08)] sm:gap-4 sm:px-4"
        >
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] shadow-[0_3px_8px_rgba(0,0,0,.25)] sm:h-[72px] sm:w-[72px]">
            {song.artwork_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- iTunes/Spotify CDNs vary
              <img
                src={song.artwork_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="radio-sleeve-kraft h-full w-full" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold text-[#241A12]">
              {song.title}
            </p>
            {song.artist ? (
              <p className="mt-0.5 truncate font-[family-name:var(--font-elite)] text-[13px] text-[#6B5636]">
                {song.artist}
              </p>
            ) : null}
            <p className="mt-1.5 truncate font-[family-name:var(--font-elite)] text-[12px] text-[#8A6F45]">
              {ropeLine(song)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {song.spotify_track_id ? (
              <a
                href={`https://open.spotify.com/track/${encodeURIComponent(song.spotify_track_id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#F4B400] px-3 py-2 text-[12px] font-semibold text-[#3E2A1E] shadow-sm transition hover:brightness-105"
              >
                <SpotifyMark size={14} />
                <span className="hidden sm:inline">Open in Spotify</span>
                <span className="sm:hidden">Spotify</span>
              </a>
            ) : null}
            {isOwner ? (
              <button
                type="button"
                disabled={removingId === song.id}
                onClick={() => void onRemove(song)}
                aria-label={`Remove ${song.title} from The Roundup`}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#8A6F45] transition hover:bg-[#33241A]/10 hover:text-[#B3402A] disabled:opacity-50"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
