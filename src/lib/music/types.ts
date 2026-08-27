export type NowPlayingTrack = {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumArtUrl: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
};

export type PlaybackContext = {
  type: "playlist";
  name: string;
} | null;

export type NowPlayingResponse =
  | { status: "not_connected" }
  | { status: "idle"; volume: number | null; shuffle: boolean }
  | {
      status: "playing";
      track: NowPlayingTrack;
      volume: number | null;
      shuffle: boolean;
      context: PlaybackContext;
    };

export type PlaybackCommand =
  | { command: "play" }
  | { command: "pause" }
  | { command: "next" }
  | { command: "previous" }
  | { command: "setVolume"; volume: number }
  | { command: "setShuffle"; shuffle: boolean };

export type MusicPlaylist = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number | null;
};

export type MusicDevice = {
  id: string;
  name: string;
  isActive: boolean;
  type: string;
};

export type PlaylistsResponse =
  | { status: "not_connected" }
  | { status: "ok"; playlists: MusicPlaylist[] };

export type DevicesResponse =
  | { status: "not_connected" }
  | { status: "ok"; devices: MusicDevice[] };

export interface MusicProvider {
  readonly id: string;
  isConnected(propertyId: string): Promise<boolean>;
  getNowPlaying(propertyId: string): Promise<NowPlayingResponse>;
  sendCommand(propertyId: string, cmd: PlaybackCommand): Promise<void>;
  listPlaylists(propertyId: string): Promise<PlaylistsResponse>;
  listDevices(propertyId: string): Promise<DevicesResponse>;
  playPlaylist(
    propertyId: string,
    playlistId: string,
    deviceId?: string,
  ): Promise<void>;
}
