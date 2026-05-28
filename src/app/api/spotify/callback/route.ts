import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOriginFromRequest } from "@/lib/site";
import {
  getSpotifyRedirectUri,
  SPOTIFY_OAUTH_PROPERTY_COOKIE,
  SPOTIFY_OAUTH_STATE_COOKIE,
} from "@/lib/spotify/config";
import {
  exchangeSpotifyCode,
  saveSpotifyCredentials,
} from "@/lib/spotify/tokens";

function dashboardRedirect(
  request: NextRequest,
  query: Record<string, string>,
) {
  const url = new URL("/dashboard", request.url);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(SPOTIFY_OAUTH_STATE_COOKIE);
  response.cookies.delete(SPOTIFY_OAUTH_PROPERTY_COOKIE);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const response = dashboardRedirect(request, { spotify: error });
    clearOAuthCookies(response);
    return response;
  }

  const storedState = request.cookies.get(SPOTIFY_OAUTH_STATE_COOKIE)?.value;
  const propertyId = request.cookies.get(SPOTIFY_OAUTH_PROPERTY_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState || !propertyId) {
    const response = dashboardRedirect(request, { spotify: "invalid_state" });
    clearOAuthCookies(response);
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearOAuthCookies(response);
    return response;
  }

  try {
    const redirectUri = getSpotifyRedirectUri(getOriginFromRequest(request));
    const credentials = await exchangeSpotifyCode(code, redirectUri);
    await saveSpotifyCredentials(propertyId, credentials);

    const response = dashboardRedirect(request, { spotify: "connected" });
    clearOAuthCookies(response);
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "token_exchange_failed";
    const response = dashboardRedirect(request, { spotify: "error" });
    response.cookies.set("spotify_connect_error", message.slice(0, 200), {
      maxAge: 60,
      path: "/",
    });
    clearOAuthCookies(response);
    return response;
  }
}
