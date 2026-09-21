import { Suspense } from "react";
import type { Metadata } from "next";
import { MusicStage } from "@/components/music/MusicStage";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  // MusicStage reads ?source= to decide radio vs Spotify, so it needs a
  // boundary to suspend against while the client router resolves it.
  return (
    <Suspense fallback={null}>
      <MusicStage />
    </Suspense>
  );
}
