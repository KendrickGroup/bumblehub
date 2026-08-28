import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { getOriginFromRequest } from "@/lib/site";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyRedirectUri,
  OAUTH_COOKIE_MAX_AGE,
  SPOTIFY_OAUTH_PROPERTY_COOKIE,
  SPOTIFY_OAUTH_STATE_COOKIE,
} from "@/lib/spotify/config";

export const dynamic = "force-dynamic";

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
      new URL("/home?spotify=missing_property", request.url),
    );
  }

  const origin = getOriginFromRequest(request);
  const redirectUri = getSpotifyRedirectUri(origin);
  const state = randomBytes(32).toString("hex");
  const authorizeUrl = buildSpotifyAuthorizeUrl({ redirectUri, state });

  const response = NextResponse.redirect(authorizeUrl);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
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
