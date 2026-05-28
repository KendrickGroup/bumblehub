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

export function getSpotifyRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/spotify/callback`;
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
