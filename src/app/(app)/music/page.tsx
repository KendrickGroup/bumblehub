import type { Metadata } from "next";
import { StubPage } from "@/components/shell/StubPage";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  return (
    <StubPage
      title="Music"
      description="Playlist browsing, devices, and full playback controls will live here."
    />
  );
}
