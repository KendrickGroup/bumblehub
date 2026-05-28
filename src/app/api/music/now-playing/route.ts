import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMusicProvider } from "@/lib/music/provider";
import type { NowPlayingResponse } from "@/lib/music/types";
import { getDefaultPropertyIdForUser } from "@/lib/property";

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
    const body: NowPlayingResponse = { status: "not_connected" };
    return NextResponse.json(body);
  }

  try {
    const provider = getMusicProvider();
    const body = await provider.getNowPlaying(propertyId);
    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch now playing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
