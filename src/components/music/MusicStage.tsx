"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";
import { RadioDial } from "@/components/music/RadioDial";
import { RadioTowerMark } from "@/components/music/AudioSourceMarks";

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
      <div className="flex flex-col gap-4 pb-4">
        <Link
          href="/music"
          className="radio-return-key"
          aria-label="Back to radio"
        >
          <RadioTowerMark size={16} />
        </Link>
        <MusicNowPlayingView />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col max-sm:h-full max-sm:overflow-hidden">
      <RadioDial />
    </div>
  );
}
