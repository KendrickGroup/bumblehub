"use client";

import { useRouter } from "next/navigation";
import { Music2, Pause, Play, Square } from "lucide-react";
import { useNowPlaying } from "@/lib/music/use-now-playing";
import { stopRadioPlayback, useRadioPlayer } from "@/lib/radio/use-radio-player";
import { useRadioNowPlaying } from "@/lib/radio/use-radio-now-playing";

export function HomeMusicPill() {
  const router = useRouter();
  const { state, busy, sendCommand } = useNowPlaying();
  const radio = useRadioPlayer();
  const radioLive =
    radio.status === "playing" || radio.status === "buffering";
  const song = useRadioNowPlaying(
    radio.streamUrl,
    radio.status === "playing",
  );

  const openMusic = () => router.push("/music");

  if (radioLive) {
    return (
      <div className="flex items-center gap-2.5 rounded-full bg-white py-2 pr-2.5 pl-2 shadow-[0_6px_18px_rgba(60,50,35,.14)]">
        <button
          type="button"
          onClick={openMusic}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-br from-[#3E5C76] to-[#8FA3B8]">
            {song?.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={song.artworkUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-extrabold text-[#241A12]">
              {song?.title ?? (radio.stationName || "Ranch House Radio")}
            </span>
            <span className="block truncate text-[10px] text-[#8A7F6E]">
              {radio.stationName || "Ranch House Radio"}
              {radio.cityLabel ? ` · ${radio.cityLabel}` : ""}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Stop radio"
          onClick={stopRadioPlayback}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#F7E19A,#F4B400_55%,#B8860B)] text-[#3E2A1E]"
        >
          <Square className="h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
        </button>
      </div>
    );
  }

  const playing =
    state?.status === "playing" && state.track.isPlaying ? state : null;
  const idle = state?.status === "idle" || state?.status === "playing";
  const title = playing?.track.name ?? "Nothing playing";
  const context =
    playing?.context?.type === "playlist"
      ? playing.context.name
      : playing?.track.artists ?? "Spotify";
  const art = playing?.track.albumArtUrl ?? null;
  const isPlaying = Boolean(playing?.track.isPlaying);

  if (!idle && state?.status !== "not_connected") {
    return (
      <button
        type="button"
        onClick={openMusic}
        className="flex w-full items-center gap-2.5 rounded-full bg-white py-2 pr-2.5 pl-2 text-left shadow-[0_6px_18px_rgba(60,50,35,.14)]"
      >
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#FFF3CF]">
          <Music2 className="h-4 w-4 text-[#B8912E]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-extrabold text-[#241A12]">
            Music
          </span>
          <span className="block truncate text-[10px] text-[#8A7F6E]">
            Ranch House Radio & Spotify
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-full bg-white py-2 pr-2.5 pl-2 shadow-[0_6px_18px_rgba(60,50,35,.14)]">
      <button
        type="button"
        onClick={openMusic}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded-[10px] bg-[#FFF3CF]">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Music2 className="h-4 w-4 text-[#B8912E]" strokeWidth={1.75} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-extrabold text-[#241A12]">
            {state?.status === "not_connected" ? "Connect Spotify" : title}
          </span>
          <span className="block truncate text-[10px] text-[#8A7F6E]">
            {state?.status === "not_connected"
              ? "Ranch House Radio & Spotify"
              : context}
          </span>
        </span>
      </button>
      {state?.status === "not_connected" ? null : (
        <button
          type="button"
          disabled={busy}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() =>
            void sendCommand({ command: isPlaying ? "pause" : "play" })
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#F7E19A,#F4B400_55%,#B8860B)] text-[#3E2A1E] disabled:opacity-50"
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
          )}
        </button>
      )}
    </div>
  );
}
