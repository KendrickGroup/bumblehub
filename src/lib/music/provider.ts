import type { MusicProvider } from "./types";
import { spotifyMusicProvider } from "@/lib/spotify/provider";

const providers: Record<string, MusicProvider> = {
  spotify: spotifyMusicProvider,
};

export function getMusicProvider(providerId = "spotify"): MusicProvider {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unknown music provider: ${providerId}`);
  }
  return provider;
}
