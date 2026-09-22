import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_ROUNDUP_PLAYLIST_URL } from "./ranch";

/**
 * Which playlist the ROUNDUP key opens.
 *
 * Set in Settings > Latigo and kept in property_settings. The env var stays as
 * a fallback for anything deployed before the field existed, but the saved
 * value wins — Dave should not need a redeploy to change a playlist.
 */

/** Spotify IDs are 22 base62 characters. */
const PLAYLIST_ID = /^[A-Za-z0-9]{22}$/;

/** open.spotify.com/intl-de/playlist/ID is the same playlist, localised. */
const PLAYLIST_PATH = /^(?:\/intl-[a-z-]+)?\/playlist\/([A-Za-z0-9]+)$/;

export function roundupPlaylistFromId(id: string): string {
  return `https://open.spotify.com/playlist/${id}`;
}

/**
 * Share links arrive with ?si= on them, which is a per-share tracking token.
 * Returns the bare playlist URL, or null if this is not one.
 */
export function cleanRoundupPlaylistUrl(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const uri = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(text);
  if (uri) {
    return PLAYLIST_ID.test(uri[1]!) ? roundupPlaylistFromId(uri[1]!) : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "open.spotify.com" && host !== "play.spotify.com") return null;
  const match = PLAYLIST_PATH.exec(parsed.pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const id = match[1]!;
  if (!PLAYLIST_ID.test(id)) return null;
  // Everything after the path is dropped: no ?si=, no #fragment, no utm.
  return roundupPlaylistFromId(id);
}

export function parseRoundupPlaylist(dashboardLayout: unknown): string {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return "";
  const layout = dashboardLayout as Record<string, unknown>;
  return cleanRoundupPlaylistUrl(layout.roundup_playlist_url) ?? "";
}

/** The saved playlist if there is one, otherwise whatever the env var says. */
export function roundupPlaylistUrl(saved: string | null | undefined): string {
  const clean = cleanRoundupPlaylistUrl(saved);
  if (clean) return clean;
  return cleanRoundupPlaylistUrl(PUBLIC_ROUNDUP_PLAYLIST_URL) ?? "";
}

export async function fetchRoundupPlaylist(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<string> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  return parseRoundupPlaylist(data?.dashboard_layout);
}

/** An empty url clears the field and hands the key back to the env fallback. */
export async function saveRoundupPlaylist(
  supabase: SupabaseClient,
  propertyId: string,
  url: string,
): Promise<string> {
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();
  const layout =
    data?.dashboard_layout && typeof data.dashboard_layout === "object"
      ? { ...(data.dashboard_layout as Record<string, unknown>) }
      : {};
  layout.roundup_playlist_url = url;
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  if (error) throw new Error(error.message);
  return parseRoundupPlaylist(layout);
}
