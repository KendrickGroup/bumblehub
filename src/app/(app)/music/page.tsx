import type { Metadata } from "next";
import { MusicStage } from "@/components/music/MusicStage";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  return <MusicStage />;
}
