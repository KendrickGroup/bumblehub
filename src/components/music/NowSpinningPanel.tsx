"use client";

import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

export function NowSpinningPanel({
  track,
  stationLine,
}: {
  track: RadioNowPlayingTrack;
  stationLine: string;
}) {
  return (
    <div
      key={`${track.title}|${track.artist ?? ""}`}
      className="radio-spin relative mt-[18px] flex items-center gap-4 rounded-[12px] px-4 py-3"
    >
      <span className="radio-spin-tag">NOW SPINNING</span>
      <div className="relative h-[84px] w-[106px] shrink-0">
        <div className="radio-vinyl" aria-hidden />
        <div className="relative z-[2] h-[84px] w-[84px] overflow-hidden rounded-[6px] shadow-[0_4px_10px_rgba(0,0,0,.35)]">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- iTunes CDN hosts vary
            <img
              key={track.artworkUrl}
              src={track.artworkUrl}
              alt=""
              className="radio-sleeve-photo h-full w-full object-cover"
            />
          ) : (
            <div className="radio-sleeve-kraft h-full w-full" aria-hidden />
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="truncate text-[17px] font-extrabold text-[#241A12]">
          {track.title}
        </p>
        {track.artist ? (
          <p className="mt-[3px] font-[family-name:var(--font-elite)] text-[13px] text-[#6B5636]">
            {track.artist}
          </p>
        ) : null}
        <p className="mt-[7px] text-[10px] font-bold tracking-[0.2em] text-[#A08A5F] uppercase">
          {stationLine}
        </p>
      </div>
    </div>
  );
}
