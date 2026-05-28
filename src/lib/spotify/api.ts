import type { NowPlayingResponse, NowPlayingTrack } from "@/lib/music/types";
import { spotifyApiFetch } from "./http";
import { getValidSpotifyAccessToken, SpotifyNotConnectedError } from "./tokens";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyArtist = { name: string };
type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { images: SpotifyImage[] };
};

type SpotifyPlayerState = {
  is_playing: boolean;
  item: SpotifyTrack | null;
  device?: { volume_percent: number | null };
};

function pickAlbumArt(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => a.width - b.width);
  return sorted[Math.floor(sorted.length / 2)]?.url ?? images[0]?.url ?? null;
}

function toNowPlayingTrack(payload: SpotifyPlayerState): NowPlayingTrack | null {
  if (!payload.item) return null;

  return {
    id: payload.item.id,
    name: payload.item.name,
    artists: payload.item.artists.map((a) => a.name).join(", "),
    albumArtUrl: pickAlbumArt(payload.item.album.images),
    isPlaying: payload.is_playing,
  };
}

export async function fetchSpotifyNowPlaying(
  propertyId: string,
): Promise<NowPlayingResponse> {
  try {
    await getValidSpotifyAccessToken(propertyId);
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      return { status: "not_connected" };
    }
    throw error;
  }

  const response = await spotifyApiFetch(propertyId, "/me/player");

  if (response.status === 204 || response.status === 202) {
    return { status: "idle", volume: null };
  }

  if (response.status === 401) {
    return { status: "not_connected" };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Spotify playback state failed (${response.status}): ${text}`,
    );
  }

  const payload = (await response.json()) as SpotifyPlayerState;
  const volume =
    typeof payload.device?.volume_percent === "number"
      ? payload.device.volume_percent
      : null;
  const track = toNowPlayingTrack(payload);

  if (!track) {
    return { status: "idle", volume };
  }

  return { status: "playing", track, volume };
}
