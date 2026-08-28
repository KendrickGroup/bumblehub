/** Every Spotify OAuth grant goes through this list. Do not duplicate it. */
export const SPOTIFY_SCOPE_LIST = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-private",
] as const;

export const SPOTIFY_SCOPES = SPOTIFY_SCOPE_LIST.join(" ");

export const LASSO_REQUIRED_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
] as const;

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

export function parseGrantedScopes(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasAllScopes(
  granted: string | null | undefined,
  required: readonly string[],
): boolean {
  const set = new Set(parseGrantedScopes(granted));
  return required.every((scope) => set.has(scope));
}

export function normalizeScopeString(
  scope: string | null | undefined,
): string | undefined {
  const parsed = parseGrantedScopes(scope);
  return parsed.length > 0 ? parsed.join(" ") : undefined;
}

/** Single authorize URL for Connect and Reconnect. Always forces the consent screen. */
export function buildSpotifyAuthorizeUrl(input: {
  redirectUri: string;
  state: string;
}): string {
  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("client_id", getSpotifyClientId());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", input.redirectUri);
  authorizeUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authorizeUrl.searchParams.set("state", input.state);
  authorizeUrl.searchParams.set("show_dialog", "true");
  return authorizeUrl.toString();
}
