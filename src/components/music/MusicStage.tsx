"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { LatigoRadioMark } from "@/components/music/AudioSourceMarks";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";
import { RadioDial } from "@/components/music/RadioDial";

export function MusicStage() {
  return (
    <Suspense fallback={null}>
      <MusicStageBody />
    </Suspense>
  );
}

function MusicStageBody() {
  const params = useSearchParams();
  const spotify = params.get("source") === "spotify";

  if (spotify) {
    return (
      <div className="relative flex min-h-0 flex-col">
        <Link
          href="/music"
          className="radio-to-dial"
          aria-label="Open Latigo Radio"
        >
          <LatigoRadioMark size={28} />
          <span>RADIO</span>
        </Link>
        <Link
          href="/home"
          className="radio-close radio-close-parchment"
          aria-label="Close Spotify and go home"
        >
          <X className="radio-close-x" strokeWidth={1.5} aria-hidden />
        </Link>
        <div className="pt-11">
          <MusicNowPlayingView />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col max-sm:h-full max-sm:overflow-hidden">
      <RadioDial />
    </div>
  );
}
