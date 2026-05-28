import type { MusicProvider, NowPlayingResponse } from "@/lib/music/types";
import { fetchSpotifyNowPlaying } from "./api";
import { isSpotifyConnected } from "./tokens";

export const spotifyMusicProvider: MusicProvider = {
  id: "spotify",

  async isConnected(propertyId: string) {
    return isSpotifyConnected(propertyId);
  },

  async getNowPlaying(propertyId: string): Promise<NowPlayingResponse> {
    return fetchSpotifyNowPlaying(propertyId);
  },
};
