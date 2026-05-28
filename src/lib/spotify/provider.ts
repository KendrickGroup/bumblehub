import type {
  DevicesResponse,
  MusicProvider,
  NowPlayingResponse,
  PlaybackCommand,
  PlaylistsResponse,
} from "@/lib/music/types";
import { fetchSpotifyNowPlaying } from "./api";
import { executeSpotifyCommand } from "./controls";
import { fetchSpotifyDevices } from "./devices";
import {
  fetchSpotifyPlaylistsOrEmpty,
  playSpotifyPlaylist,
} from "./playlists";
import { isSpotifyConnected, SpotifyNotConnectedError } from "./tokens";

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

  async listPlaylists(propertyId: string): Promise<PlaylistsResponse> {
    const result = await fetchSpotifyPlaylistsOrEmpty(propertyId);
    if (result === "not_connected") {
      return { status: "not_connected" };
    }
    return { status: "ok", playlists: result };
  },

  async listDevices(propertyId: string): Promise<DevicesResponse> {
    if (!(await isSpotifyConnected(propertyId))) {
      return { status: "not_connected" };
    }
    try {
      const devices = await fetchSpotifyDevices(propertyId);
      return { status: "ok", devices };
    } catch (error) {
      if (error instanceof SpotifyNotConnectedError) {
        return { status: "not_connected" };
      }
      throw error;
    }
  },

  async playPlaylist(
    propertyId: string,
    playlistId: string,
    deviceId?: string,
  ): Promise<void> {
    return playSpotifyPlaylist(propertyId, playlistId, deviceId);
  },
};
