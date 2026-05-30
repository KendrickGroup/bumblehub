import type { Metadata } from "next";
import Link from "next/link";
import { StubPage } from "@/components/shell/StubPage";

export const metadata: Metadata = {
  title: "Music",
};

export default function MusicPage() {
  return (
    <div>
      <StubPage
        title="Music"
        description="Playlist browsing, devices, and full playback controls will live here. Use the player above when Spotify is connected."
      />
      <p className="mt-4 px-2 text-sm text-stone-600 sm:px-0">
        Not connected yet?{" "}
        <Link
          href="/home"
          className="font-medium text-[#b8860b] underline-offset-2 hover:underline"
        >
          Connect Spotify from Home
        </Link>
        .
      </p>
    </div>
  );
}
