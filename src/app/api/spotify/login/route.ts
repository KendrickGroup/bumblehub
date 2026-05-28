import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  getSpotifyClientId,
  getSpotifyRedirectUri,
  OAUTH_COOKIE_MAX_AGE,
  SPOTIFY_OAUTH_PROPERTY_COOKIE,
  SPOTIFY_OAUTH_STATE_COOKIE,
  SPOTIFY_SCOPES,
} from "@/lib/spotify/config";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.redirect(
      new URL("/dashboard?spotify=missing_property", request.url),
    );
  }

  const state = randomBytes(32).toString("hex");
  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("client_id", getSpotifyClientId());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", getSpotifyRedirectUri());
  authorizeUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("show_dialog", "true");

  const response = NextResponse.redirect(authorizeUrl.toString());
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: "/",
  });
  response.cookies.set(SPOTIFY_OAUTH_PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
