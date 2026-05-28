import type {
  MusicProvider,
  NowPlayingResponse,
  PlaybackCommand,
} from "@/lib/music/types";
import { fetchSpotifyNowPlaying } from "./api";
import { executeSpotifyCommand } from "./controls";
import { isSpotifyConnected } from "./tokens";

export const spotifyMusicProvider: MusicProvider = {
  id: "spotify",

  async isConnected(propertyId: string) {
    return isSpotifyConnected(propertyId);
  },

  async getNowPlaying(propertyId: string): Promise<NowPlayingResponse> {
    return fetchSpotifyNowPlaying(propertyId);
  },

  async sendCommand(propertyId: string, cmd: PlaybackCommand): Promise<void> {
    return executeSpotifyCommand(propertyId, cmd);
  },
};
