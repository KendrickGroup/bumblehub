import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  RECONNECT_MESSAGE,
  SpotifyReconnectNeededError,
  lassoTrackToRoundup,
} from "@/lib/spotify/roundup";

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
      { error: "No default property configured" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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
    if (error instanceof SpotifyReconnectNeededError) {
      return NextResponse.json(
        { ok: false, code: "reconnect", error: RECONNECT_MESSAGE },
        { status: 403 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not save this song.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
