import { createClient } from "@/lib/supabase/server";
import { searchSpotifyTrack } from "@/lib/spotify/search-track";
import type { LassoInput, LassoStatus } from "./types";

function clip(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim().slice(0, max);
  return next.length > 0 ? next : null;
}

export async function lassoTrackToRoundup(
  propertyId: string,
  userId: string | null,
  input: LassoInput,
): Promise<{
  status: LassoStatus;
  step: string;
  spotifyStatus: number | null;
  spotifyError: string | null;
}> {
  const title = clip(input.title, 300);
  if (!title) {
    return {
      status: "not_found",
      step: "search",
      spotifyStatus: null,
      spotifyError: null,
    };
  }

  const artist = clip(input.artist, 200);
  const radioArt = clip(input.artworkUrl, 800);
  const stationName = clip(input.stationName, 80);
  const stationCity = clip(input.stationCity, 80);

  const search = await searchSpotifyTrack(propertyId, title, artist);
  const hit = search.hit;

  const supabase = await createClient();

  if (hit) {
    const { data: existing } = await supabase
      .from("roped_songs")
      .select("id")
      .eq("property_id", propertyId)
      .eq("spotify_track_id", hit.id)
      .maybeSingle();

    if (existing?.id) {
      return {
        status: "duplicate",
        step: "search",
        spotifyStatus: search.status,
        spotifyError: null,
      };
    }
  }

  const row = {
    property_id: propertyId,
    title,
    artist,
    artwork_url: hit?.artworkUrl ?? radioArt,
    spotify_track_id: hit?.id ?? null,
    spotify_track_uri: hit?.uri ?? null,
    station_name: stationName,
    station_city: stationCity,
    roped_by: userId,
  };

  const { error } = await supabase.from("roped_songs").insert(row);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "duplicate",
        step: "save",
        spotifyStatus: search.status,
        spotifyError: null,
      };
    }
    throw new Error(error.message);
  }

  if (!hit) {
    return {
      status: "not_found",
      step: "search",
      spotifyStatus: search.status,
      spotifyError: search.error,
    };
  }

  return {
    status: "roped",
    step: "save",
    spotifyStatus: search.status,
    spotifyError: null,
  };
}
