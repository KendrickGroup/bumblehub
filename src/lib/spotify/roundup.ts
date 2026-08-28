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

export type LassoStep =
  | "scope-check"
  | "search"
  | "playlist-lookup"
  | "playlist-create"
  | "add-track";

export type LassoStatus = "roped" | "duplicate" | "not_found";

export class LassoFailure extends Error {
  step: LassoStep;
  spotifyStatus: number | null;
  spotifyError: string;
  reconnect: boolean;

  constructor(input: {
    step: LassoStep;
    spotifyStatus?: number | null;
    spotifyError: string;
    reconnect?: boolean;
  }) {
    super(
      input.reconnect
        ? RECONNECT_MESSAGE
        : `${input.step}: ${input.spotifyError}`,
    );
    this.name = "LassoFailure";
    this.step = input.step;
    this.spotifyStatus = input.spotifyStatus ?? null;
    this.spotifyError = input.spotifyError;
    this.reconnect = input.reconnect === true;
  }
}

/** @deprecated use LassoFailure */
export class SpotifyReconnectNeededError extends LassoFailure {
  constructor(step: LassoStep = "scope-check", spotifyError = RECONNECT_MESSAGE) {
    super({
      step,
      spotifyError,
      reconnect: true,
    });
    this.name = "SpotifyReconnectNeededError";
  }
}

function sanitizeQueryPart(value: string): string {
  return value.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
}

function verbatimSpotifyError(body: unknown, text: string): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed.slice(0, 800);
  if (body && typeof body === "object") {
    try {
      return JSON.stringify(body).slice(0, 800);
    } catch {
      return "unreadable Spotify error body";
    }
  }
  return "empty Spotify error body";
}

function isInsufficientScope(status: number, body: unknown, text: string) {
  if (status !== 403) return false;
  const blob = `${text} ${typeof body === "object" ? JSON.stringify(body) : ""}`.toLowerCase();
  return blob.includes("insufficient client scope");
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
    throw new LassoFailure({
      step: "playlist-create",
      spotifyError: `Failed to save Roundup playlist id: ${error.message}`,
    });
  }
}

function storedPlaylistId(layout: Record<string, unknown>): string | null {
  const value = layout[ROUNDUP_LAYOUT_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function spotifyJson<T>(
  propertyId: string,
  path: string,
  step: LassoStep,
  init?: RequestInit,
): Promise<{ status: number; body: T | null; text: string }> {
  let response: Response;
  try {
    response = await spotifyApiFetch(propertyId, path, init);
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      throw new LassoFailure({
        step: "scope-check",
        spotifyError: "Spotify is not connected for this property",
        reconnect: true,
      });
    }
    throw new LassoFailure({
      step,
      spotifyError:
        error instanceof Error ? error.message : "Spotify request failed",
    });
  }

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
    throw new LassoFailure({
      step,
      spotifyStatus: response.status,
      spotifyError: verbatimSpotifyError(body, text),
      reconnect: true,
    });
  }

  return { status: response.status, body, text };
}

type SpotifyPlaylistList = {
  items?: Array<{ id: string; name: string }>;
  next?: string | null;
};

async function findRoundupByName(propertyId: string): Promise<string | null> {
  let path: string | null = "/me/playlists?limit=50";
  for (let page = 0; page < 4 && path; page++) {
    const result = await spotifyJson<SpotifyPlaylistList>(
      propertyId,
      path,
      "playlist-lookup",
    );
    if (result.status !== 200 || !result.body) {
      throw new LassoFailure({
        step: "playlist-lookup",
        spotifyStatus: result.status,
        spotifyError: verbatimSpotifyError(result.body, result.text),
      });
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
  const me = await spotifyJson<{ id: string }>(
    propertyId,
    "/me",
    "playlist-create",
  );
  if (me.status !== 200 || !me.body?.id) {
    throw new LassoFailure({
      step: "playlist-create",
      spotifyStatus: me.status,
      spotifyError: verbatimSpotifyError(me.body, me.text),
    });
  }

  const created = await spotifyJson<{ id: string }>(
    propertyId,
    `/users/${encodeURIComponent(me.body.id)}/playlists`,
    "playlist-create",
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
    throw new LassoFailure({
      step: "playlist-create",
      spotifyStatus: created.status,
      spotifyError: verbatimSpotifyError(created.body, created.text),
    });
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
      "playlist-lookup",
    );
    if (existing.status === 200 && existing.body?.id) return stored;
    if (existing.status === 404 || existing.status === 403) {
      const created = await createRoundup(propertyId);
      await savePlaylistId(propertyId, created);
      return created;
    }
    throw new LassoFailure({
      step: "playlist-lookup",
      spotifyStatus: existing.status,
      spotifyError: verbatimSpotifyError(existing.body, existing.text),
    });
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

  const result = await spotifyJson<{
    tracks?: { items?: Array<{ id: string }> };
  }>(
    propertyId,
    `/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=US`,
    "search",
  );
  if (result.status !== 200) {
    throw new LassoFailure({
      step: "search",
      spotifyStatus: result.status,
      spotifyError: verbatimSpotifyError(result.body, result.text),
    });
  }
  return result.body?.tracks?.items?.[0]?.id ?? null;
}

async function playlistHasTrack(
  propertyId: string,
  playlistId: string,
  trackId: string,
): Promise<boolean> {
  const result = await spotifyJson<{
    items?: Array<{ track?: { id?: string | null } | null }>;
  }>(
    propertyId,
    `/playlists/${encodeURIComponent(playlistId)}/tracks?fields=items(track(id))&limit=100`,
    "playlist-lookup",
  );
  if (result.status !== 200) {
    throw new LassoFailure({
      step: "playlist-lookup",
      spotifyStatus: result.status,
      spotifyError: verbatimSpotifyError(result.body, result.text),
    });
  }
  return (result.body?.items ?? []).some((item) => item.track?.id === trackId);
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
      throw new LassoFailure({
        step: "scope-check",
        spotifyError: `stored scopes missing playlist-modify: ${credentials.scope}`,
        reconnect: true,
      });
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
      "add-track",
      {
        method: "POST",
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
      },
    );
    if (added.status !== 201 && added.status !== 200) {
      throw new LassoFailure({
        step: "add-track",
        spotifyStatus: added.status,
        spotifyError: verbatimSpotifyError(added.body, added.text),
      });
    }
    return "roped";
  } catch (error) {
    if (error instanceof LassoFailure) throw error;
    if (error instanceof SpotifyNotConnectedError) {
      throw new LassoFailure({
        step: "scope-check",
        spotifyError: "Spotify is not connected for this property",
        reconnect: true,
      });
    }
    throw new LassoFailure({
      step: "scope-check",
      spotifyError:
        error instanceof Error ? error.message : "Lasso failed before Spotify",
    });
  }
}
