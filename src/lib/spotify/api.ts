import type { NowPlayingResponse, NowPlayingTrack } from "@/lib/music/types";
import { getValidSpotifyAccessToken, SpotifyNotConnectedError } from "./tokens";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyArtist = { name: string };
type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { images: SpotifyImage[] };
};

type SpotifyCurrentlyPlaying = {
  is_playing: boolean;
  item: SpotifyTrack | null;
};

function pickAlbumArt(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => a.width - b.width);
  return sorted[Math.floor(sorted.length / 2)]?.url ?? images[0]?.url ?? null;
}

function toNowPlayingTrack(payload: SpotifyCurrentlyPlaying): NowPlayingTrack | null {
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
  let accessToken: string;
  try {
    accessToken = await getValidSpotifyAccessToken(propertyId);
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      return { status: "not_connected" };
    }
    throw error;
  }

  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (response.status === 204 || response.status === 202) {
    return { status: "idle" };
  }

  if (response.status === 401) {
    return { status: "not_connected" };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Spotify currently-playing failed (${response.status}): ${text}`,
    );
  }

  const payload = (await response.json()) as SpotifyCurrentlyPlaying;
  const track = toNowPlayingTrack(payload);
  if (!track) {
    return { status: "idle" };
  }

  return { status: "playing", track };
}
