import { createClient } from "@/lib/supabase/server";
import { hasAllScopes, LASSO_REQUIRED_SCOPES } from "./config";
import { spotifyApiFetch } from "./http";
import {
  loadSpotifyCredentials,
  SpotifyNotConnectedError,
} from "./tokens";

export const ROUNDUP_NAME = "The Latigo Roundup";
export const ROUNDUP_DESCRIPTION =
  "Songs roped off the Ranch House Radio at the Latigo Ranch House, Sutter Creek, California.";
export const ROUNDUP_LAYOUT_KEY = "latigo_roundup_playlist_id";
export const RECONNECT_MESSAGE =
  "Reconnect Spotify in Settings to enable saving";

export class SpotifyReconnectNeededError extends Error {
  constructor() {
    super(RECONNECT_MESSAGE);
    this.name = "SpotifyReconnectNeededError";
  }
}

export type LassoStatus = "roped" | "duplicate" | "not_found";

function sanitizeQueryPart(value: string): string {
  return value.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
}

async function readLayout(
  propertyId: string,
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  return data?.dashboard_layout && typeof data.dashboard_layout === "object"
    ? { ...(data.dashboard_layout as Record<string, unknown>) }
    : {};
}

async function savePlaylistId(propertyId: string, playlistId: string) {
  const layout = await readLayout(propertyId);
  layout[ROUNDUP_LAYOUT_KEY] = playlistId;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: now,
    },
    { onConflict: "property_id" },
  );
  if (error) {
    throw new Error(`Failed to save Roundup playlist: ${error.message}`);
  }
}

function storedPlaylistId(layout: Record<string, unknown>): string | null {
  const value = layout[ROUNDUP_LAYOUT_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isInsufficientScope(status: number, body: unknown, text: string) {
  if (status !== 403) return false;
  const blob = text.toLowerCase();
  if (blob.includes("insufficient client scope")) return true;
  if (!body || typeof body !== "object") return false;
  const nested = (body as { error?: { message?: unknown } }).error;
  const message =
    nested && typeof nested === "object" && typeof nested.message === "string"
      ? nested.message.toLowerCase()
      : "";
  return message.includes("insufficient client scope");
}

async function spotifyJson<T>(
  propertyId: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: T | null }> {
  const response = await spotifyApiFetch(propertyId, path, init);
  const text =
    response.status === 204 ? "" : await response.text().catch(() => "");
  let body: T | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }
  if (isInsufficientScope(response.status, body, text)) {
    throw new SpotifyReconnectNeededError();
  }
  if (response.status === 204) {
    return { status: 204, body: null };
  }
  return { status: response.status, body };
}

type SpotifyPlaylistList = {
  items?: Array<{ id: string; name: string }>;
  next?: string | null;
};

async function findRoundupByName(propertyId: string): Promise<string | null> {
  let path: string | null = "/me/playlists?limit=50";
  for (let page = 0; page < 4 && path; page++) {
    const result = await spotifyJson<SpotifyPlaylistList>(propertyId, path);
    if (result.status !== 200 || !result.body) {
      throw new Error(`Spotify playlists failed (${result.status})`);
    }
    const playlists: SpotifyPlaylistList = result.body;
    const match = (playlists.items ?? []).find(
      (item) =>
        item.name.trim().toLowerCase() === ROUNDUP_NAME.toLowerCase(),
    );
    if (match?.id) return match.id;
    path = playlists.next ?? null;
  }
  return null;
}

async function createRoundup(propertyId: string): Promise<string> {
  const me = await spotifyJson<{ id: string }>(propertyId, "/me");
  if (me.status !== 200 || !me.body?.id) {
    throw new Error(`Spotify profile failed (${me.status})`);
  }

  const created = await spotifyJson<{ id: string }>(
    propertyId,
    `/users/${encodeURIComponent(me.body.id)}/playlists`,
    {
      method: "POST",
      body: JSON.stringify({
        name: ROUNDUP_NAME,
        public: true,
        description: ROUNDUP_DESCRIPTION,
      }),
    },
  );
  if ((created.status !== 201 && created.status !== 200) || !created.body?.id) {
    throw new Error(`Could not create The Latigo Roundup (${created.status})`);
  }
  return created.body.id;
}

async function resolveRoundupPlaylistId(propertyId: string): Promise<string> {
  const layout = await readLayout(propertyId);
  const stored = storedPlaylistId(layout);

  if (stored) {
    const existing = await spotifyJson<{ id: string }>(
      propertyId,
      `/playlists/${encodeURIComponent(stored)}`,
    );
    if (existing.status === 200 && existing.body?.id) return stored;
    if (existing.status === 404 || existing.status === 403) {
      const created = await createRoundup(propertyId);
      await savePlaylistId(propertyId, created);
      return created;
    }
    throw new Error(`Spotify playlist lookup failed (${existing.status})`);
  }

  const found = await findRoundupByName(propertyId);
  if (found) {
    await savePlaylistId(propertyId, found);
    return found;
  }

  const created = await createRoundup(propertyId);
  await savePlaylistId(propertyId, created);
  return created;
}

async function searchSpotifyTrack(
  propertyId: string,
  title: string,
  artist: string | null,
): Promise<string | null> {
  const trackPart = sanitizeQueryPart(title);
  const artistPart = artist ? sanitizeQueryPart(artist) : "";
  if (!trackPart) return null;

  const query = artistPart
    ? `track:"${trackPart}" artist:"${artistPart}"`
    : `track:"${trackPart}"`;

  const { status, body } = await spotifyJson<{
    tracks?: { items?: Array<{ id: string }> };
  }>(
    propertyId,
    `/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=US`,
  );
  if (status !== 200) {
    throw new Error(`Spotify search failed (${status})`);
  }
  return body?.tracks?.items?.[0]?.id ?? null;
}

async function playlistHasTrack(
  propertyId: string,
  playlistId: string,
  trackId: string,
): Promise<boolean> {
  const { status, body } = await spotifyJson<{
    items?: Array<{ track?: { id?: string | null } | null }>;
  }>(
    propertyId,
    `/playlists/${encodeURIComponent(playlistId)}/tracks?fields=items(track(id))&limit=100`,
  );
  if (status !== 200) {
    throw new Error(`Spotify playlist tracks failed (${status})`);
  }
  return (body?.items ?? []).some((item) => item.track?.id === trackId);
}

export async function lassoTrackToRoundup(
  propertyId: string,
  title: string,
  artist: string | null,
): Promise<LassoStatus> {
  try {
    const credentials = await loadSpotifyCredentials(propertyId);
    if (
      credentials.scope &&
      !hasAllScopes(credentials.scope, LASSO_REQUIRED_SCOPES)
    ) {
      throw new SpotifyReconnectNeededError();
    }

    const trackId = await searchSpotifyTrack(propertyId, title, artist);
    if (!trackId) return "not_found";

    const playlistId = await resolveRoundupPlaylistId(propertyId);
    if (await playlistHasTrack(propertyId, playlistId, trackId)) {
      return "duplicate";
    }

    const added = await spotifyJson(
      propertyId,
      `/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        method: "POST",
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
      },
    );
    if (added.status !== 201 && added.status !== 200) {
      throw new Error(`Could not add track (${added.status})`);
    }
    return "roped";
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      throw new SpotifyReconnectNeededError();
    }
    throw error;
  }
}
