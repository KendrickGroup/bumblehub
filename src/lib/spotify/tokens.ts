import { createServiceClient } from "@/lib/supabase/server";
import {
  credentialsFromTokenResponse,
  parseSpotifyCredentials,
  type SpotifyCredentials,
  type SpotifyTokenResponse,
} from "./credentials";
import {
  getSpotifyClientId,
  getSpotifyClientSecret,
  normalizeScopeString,
} from "./config";

const EXPIRY_MARGIN_SECONDS = 60;

export class SpotifyNotConnectedError extends Error {
  constructor() {
    super("Spotify is not connected for this property");
    this.name = "SpotifyNotConnectedError";
  }
}

async function fetchSpotifyTokens(
  params: URLSearchParams,
): Promise<SpotifyTokenResponse> {
  const basic = Buffer.from(
    `${getSpotifyClientId()}:${getSpotifyClientSecret()}`,
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const body = (await response.json()) as SpotifyTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.error_description ?? body.error ?? "Spotify token request failed",
    );
  }

  return body;
}

export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string,
  existingRefreshToken?: string,
): Promise<SpotifyCredentials> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  return credentialsFromTokenResponse(
    await fetchSpotifyTokens(params),
    existingRefreshToken,
  );
}

async function refreshSpotifyCredentials(
  current: SpotifyCredentials,
): Promise<SpotifyCredentials> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
  });

  const refreshed = credentialsFromTokenResponse(
    await fetchSpotifyTokens(params),
    current.refresh_token,
  );
  // Refresh responses sometimes omit scope; never wipe a known grant.
  if (!refreshed.scope && current.scope) {
    refreshed.scope = current.scope;
  }
  return refreshed;
}

export async function saveSpotifyCredentials(
  propertyId: string,
  credentials: SpotifyCredentials,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const stored: SpotifyCredentials = {
    ...credentials,
    scope: normalizeScopeString(credentials.scope),
  };

  const { error } = await supabase.from("integrations").upsert(
    {
      property_id: propertyId,
      integration_type: "spotify",
      display_name: "Spotify",
      credentials: stored,
      is_connected: true,
      last_synced_at: now,
      updated_at: now,
    },
    { onConflict: "property_id,integration_type" },
  );

  if (error) {
    throw new Error(`Failed to save Spotify credentials: ${error.message}`);
  }
}

async function loadSpotifyIntegration(propertyId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("credentials, is_connected")
    .eq("property_id", propertyId)
    .eq("integration_type", "spotify")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Spotify integration: ${error.message}`);
  }

  return data;
}

export async function loadSpotifyCredentials(
  propertyId: string,
): Promise<SpotifyCredentials> {
  const row = await loadSpotifyIntegration(propertyId);
  if (!row?.is_connected) {
    throw new SpotifyNotConnectedError();
  }

  const credentials = parseSpotifyCredentials(row.credentials);
  if (!credentials) {
    throw new SpotifyNotConnectedError();
  }
  return credentials;
}

export async function getValidSpotifyAccessToken(
  propertyId: string,
): Promise<string> {
  const credentials = await loadSpotifyCredentials(propertyId);
  const now = Math.floor(Date.now() / 1000);
  if (credentials.expires_at - EXPIRY_MARGIN_SECONDS > now) {
    return credentials.access_token;
  }

  const refreshed = await refreshSpotifyCredentials(credentials);
  await saveSpotifyCredentials(propertyId, refreshed);
  return refreshed.access_token;
}

export async function isSpotifyConnected(propertyId: string): Promise<boolean> {
  try {
    await loadSpotifyCredentials(propertyId);
    return true;
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) return false;
    throw error;
  }
}
