"use client";

import { useState } from "react";
import Link from "next/link";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";
import { RadioDial } from "@/components/music/RadioDial";
import {
  RoundupRopeMark,
  SpotifyMark,
} from "@/components/music/AudioSourceMarks";
import { stopRadioForSpotifyPlayback } from "@/lib/radio/use-radio-player";

type Source = "radio" | "spotify";

export function MusicStage() {
  const [source, setSource] = useState<Source>("radio");

  const onSource = (next: Source) => {
    if (next === "spotify") stopRadioForSpotifyPlayback();
    setSource(next);
  };

  return (
    <div className="flex flex-col gap-8 pb-4">
      <div className="mx-auto flex min-h-[44px] w-full max-w-[720px] flex-col items-center gap-3">
        <div className="inline-flex rounded-full border border-stone-200 bg-white p-1 shadow-sm">
          <ToggleChip
            active={source === "radio"}
            onClick={() => onSource("radio")}
          >
            Radio
          </ToggleChip>
          <ToggleChip
            active={source === "spotify"}
            onClick={() => onSource("spotify")}
          >
            <SpotifyMark size={14} />
            Spotify
          </ToggleChip>
        </div>
        <Link
          href="/music/roundup"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#C9A24B]/40 bg-[#FFF8EA] px-3.5 text-[13px] font-semibold text-[#3E2A1E] shadow-sm transition hover:border-[#C9A24B] hover:bg-[#FBF0D0]"
        >
          <RoundupRopeMark size={16} className="text-[#8A6F45]" />
          <span className="font-[family-name:var(--font-elite)]">
            The Roundup
          </span>
        </Link>
      </div>
      {source === "radio" ? <RadioDial /> : <MusicNowPlayingView />}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
        active
          ? "bg-[#F4B400] text-stone-900"
          : "text-stone-600 hover:text-stone-900"
      }`}
    >
      {children}
    </button>
  );
}
