import type { Metadata } from "next";
import { MusicNowPlayingView } from "@/components/music/MusicNowPlayingView";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  return <MusicNowPlayingView />;
}
