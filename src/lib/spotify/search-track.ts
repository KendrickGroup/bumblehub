import { spotifyApiFetch } from "./http";
import { SpotifyNotConnectedError } from "./tokens";

export type SpotifySearchHit = {
  id: string;
  uri: string;
  artworkUrl: string | null;
};

type SearchTrackItem = {
  id?: string;
  uri?: string;
  album?: { images?: Array<{ url?: string; width?: number }> };
};

function pickArtwork(
  images: Array<{ url?: string; width?: number }> | undefined,
): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const url = sorted[0]?.url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function sanitizeQueryPart(value: string): string {
  return value.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
}

function verbatimError(body: unknown, text: string): string {
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

/**
 * Read-only Spotify search. Failures never throw reconnect — playlist writes
 * are blocked in Development Mode, but search still works when connected.
 */
export async function searchSpotifyTrack(
  propertyId: string,
  title: string,
  artist: string | null,
): Promise<{
  hit: SpotifySearchHit | null;
  status: number | null;
  error: string | null;
}> {
  const trackPart = sanitizeQueryPart(title);
  if (!trackPart) {
    return { hit: null, status: null, error: null };
  }

  const artistPart = artist ? sanitizeQueryPart(artist) : "";
  const query = artistPart
    ? `track:"${trackPart}" artist:"${artistPart}"`
    : `track:"${trackPart}"`;

  try {
    const response = await spotifyApiFetch(
      propertyId,
      `/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=US`,
    );
    const text = await response.text().catch(() => "");
    let body: {
      tracks?: { items?: SearchTrackItem[] };
    } | null = null;
    if (text) {
      try {
        body = JSON.parse(text) as { tracks?: { items?: SearchTrackItem[] } };
      } catch {
        body = null;
      }
    }

    if (response.status !== 200) {
      const error = verbatimError(body, text);
      console.info(
        JSON.stringify({
          msg: "radio.lasso.search",
          status: response.status,
          error,
        }),
      );
      return { hit: null, status: response.status, error };
    }

    const item = body?.tracks?.items?.[0];
    const id = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : null;
    if (!id) {
      return { hit: null, status: 200, error: null };
    }

    const uri =
      typeof item?.uri === "string" && item.uri.trim()
        ? item.uri.trim()
        : `spotify:track:${id}`;

    return {
      hit: {
        id,
        uri,
        artworkUrl: pickArtwork(item?.album?.images),
      },
      status: 200,
      error: null,
    };
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      return {
        hit: null,
        status: null,
        error: "Spotify is not connected for this property",
      };
    }
    const message =
      error instanceof Error ? error.message : "Spotify search failed";
    console.info(
      JSON.stringify({
        msg: "radio.lasso.search",
        status: null,
        error: message,
      }),
    );
    return { hit: null, status: null, error: message };
  }
}
