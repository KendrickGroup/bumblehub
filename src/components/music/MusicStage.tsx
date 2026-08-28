"use client";

import { useState } from "react";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";
import { RadioDial } from "@/components/music/RadioDial";
import { SpotifyMark } from "@/components/music/AudioSourceMarks";
import { stopRadioPlayback } from "@/lib/radio/use-radio-player";

type Source = "radio" | "spotify";

export function MusicStage() {
  const [source, setSource] = useState<Source>("radio");

  const onSource = (next: Source) => {
    if (next === "spotify") stopRadioPlayback();
    setSource(next);
  };

  return (
    <div className="flex flex-col gap-8 pb-4">
      <div className="mx-auto flex min-h-[44px] w-full max-w-[720px] justify-center">
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
