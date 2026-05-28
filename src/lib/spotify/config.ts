export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "user-read-private",
].join(" ");

export const SPOTIFY_OAUTH_STATE_COOKIE = "spotify_oauth_state";
export const SPOTIFY_OAUTH_PROPERTY_COOKIE = "spotify_oauth_property_id";
export const OAUTH_COOKIE_MAX_AGE = 600;

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getSpotifyRedirectUri(): string {
  return `${getSiteUrl()}/api/spotify/callback`;
}

export function getSpotifyClientId(): string {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (!id) {
    throw new Error("SPOTIFY_CLIENT_ID is not set");
  }
  return id;
}

export function getSpotifyClientSecret(): string {
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!secret) {
    throw new Error("SPOTIFY_CLIENT_SECRET is not set");
  }
  return secret;
}
