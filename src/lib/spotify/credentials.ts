export type SpotifyCredentials = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
};

export function parseSpotifyCredentials(
  raw: unknown,
): SpotifyCredentials | null {
  if (!raw || typeof raw !== "object") return null;

  const creds = raw as Record<string, unknown>;
  if (
    typeof creds.access_token !== "string" ||
    typeof creds.refresh_token !== "string" ||
    typeof creds.expires_at !== "number"
  ) {
    return null;
  }

  return {
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expires_at: creds.expires_at,
    token_type:
      typeof creds.token_type === "string" ? creds.token_type : undefined,
    scope: typeof creds.scope === "string" ? creds.scope : undefined,
  };
}

export function credentialsFromTokenResponse(
  body: SpotifyTokenResponse,
  existingRefreshToken?: string,
): SpotifyCredentials {
  const refreshToken = body.refresh_token ?? existingRefreshToken;
  if (!refreshToken) {
    throw new Error("Spotify token response missing refresh_token");
  }

  return {
    access_token: body.access_token,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + body.expires_in,
    token_type: body.token_type,
    scope: body.scope,
  };
}

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};
