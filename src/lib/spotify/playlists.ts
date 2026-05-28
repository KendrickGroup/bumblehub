import type { MusicPlaylist } from "@/lib/music/types";
import { spotifyApiFetch } from "./http";
import { resolveSpotifyPlaybackDeviceId } from "./devices";
import { SpotifyNotConnectedError } from "./tokens";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyPlaylistItem = {
  id: string;
  name: string;
  images: SpotifyImage[];
  tracks: { total: number };
};
type SpotifyPlaylistsResponse = {
  items: SpotifyPlaylistItem[];
};

function pickCover(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

export async function fetchSpotifyPlaylists(
  propertyId: string,
): Promise<MusicPlaylist[]> {
  const response = await spotifyApiFetch(
    propertyId,
    "/me/playlists?limit=50",
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify playlists failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as SpotifyPlaylistsResponse;
  return (payload.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: pickCover(item.images),
    trackCount: item.tracks?.total ?? null,
  }));
}

export async function playSpotifyPlaylist(
  propertyId: string,
  playlistId: string,
  deviceId?: string,
): Promise<void> {
  const targetDeviceId =
    deviceId ?? (await resolveSpotifyPlaybackDeviceId(propertyId));

  const response = await spotifyApiFetch(
    propertyId,
    `/me/player/play?device_id=${encodeURIComponent(targetDeviceId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        context_uri: `spotify:playlist:${playlistId}`,
      }),
    },
  );

  if (response.status === 204 || response.status === 200) {
    return;
  }

  const text = await response.text();
  if (response.status === 404) {
    throw new Error(
      "No active Spotify Connect device. Open Spotify on the Mac Mini.",
    );
  }
  throw new Error(`Spotify play playlist failed (${response.status}): ${text}`);
}

export async function fetchSpotifyPlaylistsOrEmpty(
  propertyId: string,
): Promise<MusicPlaylist[] | "not_connected"> {
  try {
    return await fetchSpotifyPlaylists(propertyId);
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      return "not_connected";
    }
    throw error;
  }
}
