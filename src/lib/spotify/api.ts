import type {
  NowPlayingResponse,
  NowPlayingTrack,
  PlaybackContext,
} from "@/lib/music/types";
import { spotifyApiFetch } from "./http";
import { getValidSpotifyAccessToken, SpotifyNotConnectedError } from "./tokens";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyArtist = { name: string };
type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: { name: string; images: SpotifyImage[] };
};

type SpotifyPlayerState = {
  is_playing: boolean;
  progress_ms: number | null;
  shuffle_state?: boolean;
  item: SpotifyTrack | null;
  device?: { volume_percent: number | null };
  context?: { type?: string | null; uri?: string | null } | null;
};

const contextNameCache = new Map<string, { name: string; at: number }>();
const CONTEXT_CACHE_MS = 10 * 60 * 1000;

function playlistIdFromUri(uri: string): string | null {
  const parts = uri.split(":");
  const index = parts.lastIndexOf("playlist");
  const id = index >= 0 ? parts[index + 1] : undefined;
  return id && /^[A-Za-z0-9]+$/.test(id) ? id : null;
}

async function resolvePlaybackContext(
  propertyId: string,
  context: SpotifyPlayerState["context"],
): Promise<PlaybackContext> {
  if (!context || context.type !== "playlist" || !context.uri) return null;
  const cached = contextNameCache.get(context.uri);
  if (cached && Date.now() - cached.at < CONTEXT_CACHE_MS) {
    return { type: "playlist", name: cached.name };
  }
  const playlistId = playlistIdFromUri(context.uri);
  if (!playlistId) return null;
  try {
    const response = await spotifyApiFetch(
      propertyId,
      `/playlists/${playlistId}?fields=name`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return null;
    contextNameCache.set(context.uri, { name, at: Date.now() });
    return { type: "playlist", name };
  } catch {
    return null;
  }
}

/** Prefer the largest image Spotify returns (typically 640px). */
function pickAlbumArt(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => b.width - a.width);
  return sorted[0]?.url ?? null;
}

function toNowPlayingTrack(payload: SpotifyPlayerState): NowPlayingTrack | null {
  if (!payload.item) return null;

  return {
    id: payload.item.id,
    name: payload.item.name,
    artists: payload.item.artists.map((a) => a.name).join(", "),
    album: payload.item.album.name,
    albumArtUrl: pickAlbumArt(payload.item.album.images),
    isPlaying: payload.is_playing,
    progressMs: Math.max(0, payload.progress_ms ?? 0),
    durationMs: Math.max(0, payload.item.duration_ms ?? 0),
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
    return { status: "idle", volume: null, shuffle: false };
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
  const shuffle = Boolean(payload.shuffle_state);
  const track = toNowPlayingTrack(payload);

  if (!track) {
    return { status: "idle", volume, shuffle };
  }

  const context = await resolvePlaybackContext(propertyId, payload.context);
  return { status: "playing", track, volume, shuffle, context };
}
