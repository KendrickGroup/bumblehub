"use client";

import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

export function NowSpinningPanel({
  track,
  stationLine,
}: {
  track: RadioNowPlayingTrack;
  stationLine: string;
}) {
  const artWords = track.title.split(/\s+/).slice(0, 3).join("\n");

  return (
    <div
      key={`${track.title}|${track.artist ?? ""}`}
      className="radio-spin relative mt-[18px] flex items-center gap-4 rounded-[12px] px-4 py-3"
    >
      <span className="radio-spin-tag">NOW SPINNING</span>
      <div className="relative h-[84px] w-[106px] shrink-0">
        <div className="radio-vinyl" aria-hidden />
        {track.artworkUrl ? (
          <div className="relative z-[2] h-[84px] w-[84px] overflow-hidden rounded-[6px] shadow-[0_4px_10px_rgba(0,0,0,.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- stream artwork hosts vary */}
            <img
              src={track.artworkUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="radio-sleeve-art relative z-[2] flex h-[84px] w-[84px] items-end rounded-[6px] p-1.5">
            <span className="font-[family-name:var(--font-rye)] text-[10px] leading-[1.15] whitespace-pre-line text-[#F3E9CF] [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
              {artWords}
            </span>
          </div>
        )}
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
