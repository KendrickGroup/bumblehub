import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMusicProvider } from "@/lib/music/provider";
import { getDefaultPropertyIdForUser } from "@/lib/property";

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const playlistId = (body as { playlistId?: unknown }).playlistId;
  const deviceId = (body as { deviceId?: unknown }).deviceId;

  if (typeof playlistId !== "string" || !playlistId) {
    return NextResponse.json({ error: "playlistId is required" }, { status: 400 });
  }

  try {
    const provider = getMusicProvider();
    await provider.playPlaylist(
      propertyId,
      playlistId,
      typeof deviceId === "string" ? deviceId : undefined,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start playlist";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
