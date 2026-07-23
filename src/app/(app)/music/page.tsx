import type { Metadata } from "next";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  return (
    <div className="px-4 pb-6 pt-2 sm:px-6 sm:pt-4">
      <MusicNowPlayingView />
    </div>
  );
}
