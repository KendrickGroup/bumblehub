import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  cleanRoundupPlaylistUrl,
  fetchRoundupPlaylist,
  roundupPlaylistUrl,
  saveRoundupPlaylist,
} from "@/lib/radio/roundup-playlist";

const NO_STORE = { "Cache-Control": "no-store" };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, propertyId: null as string | null };
  return { supabase, propertyId: await getDefaultPropertyIdForUser(user.id) };
}

export async function GET() {
  const { supabase, propertyId } = await session();
  if (!propertyId) {
    return NextResponse.json({ roundup_playlist_url: "", hasProperty: false });
  }
  const saved = await fetchRoundupPlaylist(supabase, propertyId);
  return NextResponse.json(
    {
      roundup_playlist_url: saved,
      effective_url: roundupPlaylistUrl(saved),
      hasProperty: true,
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const { supabase, propertyId } = await session();
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

  const raw = String((body as { url?: unknown }).url ?? "").trim();
  const url = raw ? cleanRoundupPlaylistUrl(raw) : "";
  if (url === null) {
    return NextResponse.json(
      { error: "Paste a Spotify playlist link." },
      { status: 400 },
    );
  }

  try {
    const saved = await saveRoundupPlaylist(supabase, propertyId, url);
    return NextResponse.json(
      { roundup_playlist_url: saved, effective_url: roundupPlaylistUrl(saved) },
      { headers: NO_STORE },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save." },
      { status: 500 },
    );
  }
}
