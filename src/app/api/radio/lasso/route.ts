import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { lassoTrackToRoundup } from "@/lib/roundup/lasso";

export async function POST(request: Request) {
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
      {
        ok: false,
        error: "No default property configured",
        step: "save",
        spotifyStatus: null,
        spotifyError: "No default property configured",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON",
        step: "save",
        spotifyStatus: null,
        spotifyError: "Invalid JSON",
      },
      { status: 400 },
    );
  }

  const raw = body as {
    title?: unknown;
    artist?: unknown;
    artworkUrl?: unknown;
    stationName?: unknown;
    stationCity?: unknown;
  };

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const artist =
    typeof raw.artist === "string" && raw.artist.trim()
      ? raw.artist.trim()
      : null;
  const artworkUrl =
    typeof raw.artworkUrl === "string" && raw.artworkUrl.trim()
      ? raw.artworkUrl.trim()
      : null;
  const stationName =
    typeof raw.stationName === "string" && raw.stationName.trim()
      ? raw.stationName.trim()
      : null;
  const stationCity =
    typeof raw.stationCity === "string" && raw.stationCity.trim()
      ? raw.stationCity.trim()
      : null;

  if (!title) {
    return NextResponse.json({ ok: true, status: "not_found" as const });
  }

  try {
    const result = await lassoTrackToRoundup(propertyId, user.id, {
      title,
      artist,
      artworkUrl,
      stationName,
      stationCity,
    });
    return NextResponse.json({
      ok: true,
      status: result.status,
      ...(result.status === "not_found" && result.spotifyError
        ? {
            step: result.step,
            spotifyStatus: result.spotifyStatus,
            spotifyError: result.spotifyError,
          }
        : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save this song.";
    console.info(
      JSON.stringify({
        msg: "radio.lasso.failure",
        propertyId,
        step: "save",
        spotifyError: message,
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: message,
        step: "save",
        spotifyStatus: null,
        spotifyError: message,
      },
      { status: 502 },
    );
  }
}
