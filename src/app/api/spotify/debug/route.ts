import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import {
  hasAllScopes,
  LASSO_REQUIRED_SCOPES,
  parseGrantedScopes,
} from "@/lib/spotify/config";
import { spotifyApiFetch } from "@/lib/spotify/http";
import {
  loadSpotifyCredentials,
  SpotifyNotConnectedError,
} from "@/lib/spotify/tokens";
import { ROUNDUP_LAYOUT_KEY } from "@/lib/spotify/roundup";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json(
      { error: "No default property configured" },
      { status: 400 },
    );
  }

  if (!(await isPropertyOwner(propertyId, user.id))) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  let grantedScopeString: string | null = null;
  let connected = false;
  try {
    const credentials = await loadSpotifyCredentials(propertyId);
    connected = true;
    grantedScopeString = credentials.scope ?? null;
  } catch (error) {
    if (!(error instanceof SpotifyNotConnectedError)) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load Spotify credentials",
        },
        { status: 500 },
      );
    }
  }

  const { data: settings } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  const layout =
    settings?.dashboard_layout && typeof settings.dashboard_layout === "object"
      ? (settings.dashboard_layout as Record<string, unknown>)
      : {};
  const playlistIdRaw = layout[ROUNDUP_LAYOUT_KEY];
  const latigoRoundupPlaylistId =
    typeof playlistIdRaw === "string" && playlistIdRaw.trim()
      ? playlistIdRaw.trim()
      : null;

  let me: {
    status: number | null;
    userId: string | null;
    error: string | null;
  } = { status: null, userId: null, error: "skipped — Spotify not connected" };

  if (connected) {
    try {
      const response = await spotifyApiFetch(propertyId, "/me");
      const text = await response.text();
      let userId: string | null = null;
      if (text) {
        try {
          const parsed = JSON.parse(text) as { id?: unknown };
          userId = typeof parsed.id === "string" ? parsed.id : null;
        } catch {
          userId = null;
        }
      }
      me = {
        status: response.status,
        userId,
        error: response.ok ? null : text.slice(0, 800) || `HTTP ${response.status}`,
      };
    } catch (error) {
      me = {
        status: null,
        userId: null,
        error: error instanceof Error ? error.message : "GET /v1/me failed",
      };
    }
  }

  return NextResponse.json({
    connected,
    grantedScopes: parseGrantedScopes(grantedScopeString ?? undefined),
    grantedScopeString,
    hasLassoScopes: hasAllScopes(grantedScopeString, LASSO_REQUIRED_SCOPES),
    latigoRoundupPlaylistId,
    latigoRoundupPlaylistIdExists: latigoRoundupPlaylistId !== null,
    me,
  });
}
