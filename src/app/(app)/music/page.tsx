import type { Metadata } from "next";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";
import { RadioDial } from "@/components/music/RadioDial";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  return (
    <div className="flex flex-col gap-10 pb-4">
      <RadioDial />
      <MusicNowPlayingView />
    </div>
  );
}
