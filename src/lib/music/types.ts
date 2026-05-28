export type NowPlayingTrack = {
  id: string;
  name: string;
  artists: string;
  albumArtUrl: string | null;
  isPlaying: boolean;
};

export type NowPlayingResponse =
  | { status: "not_connected" }
  | { status: "idle" }
  | { status: "playing"; track: NowPlayingTrack };

export interface MusicProvider {
  readonly id: string;
  isConnected(propertyId: string): Promise<boolean>;
  getNowPlaying(propertyId: string): Promise<NowPlayingResponse>;
}
