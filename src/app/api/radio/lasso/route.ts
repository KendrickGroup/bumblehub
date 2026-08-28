import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  LassoFailure,
  RECONNECT_MESSAGE,
  lassoTrackToRoundup,
} from "@/lib/spotify/roundup";

function failurePayload(error: LassoFailure) {
  return {
    ok: false as const,
    code: error.reconnect ? ("reconnect" as const) : undefined,
    error: error.reconnect ? RECONNECT_MESSAGE : error.message,
    step: error.step,
    spotifyStatus: error.spotifyStatus,
    spotifyError: error.spotifyError,
  };
}

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
        step: "scope-check",
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
        step: "scope-check",
        spotifyStatus: null,
        spotifyError: "Invalid JSON",
      },
      { status: 400 },
    );
  }

  const title =
    typeof (body as { title?: unknown }).title === "string"
      ? (body as { title: string }).title.trim()
      : "";
  const artistRaw = (body as { artist?: unknown }).artist;
  const artist =
    typeof artistRaw === "string" && artistRaw.trim()
      ? artistRaw.trim()
      : null;

  if (!title) {
    return NextResponse.json({ ok: true, status: "not_found" as const });
  }

  try {
    const status = await lassoTrackToRoundup(propertyId, title, artist);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof LassoFailure) {
      console.info(
        JSON.stringify({
          msg: "radio.lasso.failure",
          propertyId,
          step: error.step,
          spotifyStatus: error.spotifyStatus,
          spotifyError: error.spotifyError,
          reconnect: error.reconnect,
        }),
      );
      return NextResponse.json(failurePayload(error), {
        status: error.reconnect ? 403 : 502,
      });
    }
    const message =
      error instanceof Error ? error.message : "Could not save this song.";
    console.info(
      JSON.stringify({
        msg: "radio.lasso.failure",
        propertyId,
        step: "scope-check",
        spotifyError: message,
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: message,
        step: "scope-check",
        spotifyStatus: null,
        spotifyError: message,
      },
      { status: 502 },
    );
  }
}
