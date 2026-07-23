import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePlaybackCommand } from "@/lib/music/commands";
import { getMusicProvider } from "@/lib/music/provider";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { SpotifyNoActiveDeviceError } from "@/lib/spotify/controls";

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

  const command = parsePlaybackCommand(body);
  if (!command) {
    return NextResponse.json({ error: "Invalid command" }, { status: 400 });
  }

  try {
    const provider = getMusicProvider();
    await provider.sendCommand(propertyId, command);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SpotifyNoActiveDeviceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "NO_ACTIVE_DEVICE",
        },
        { status: 404 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Playback command failed";
    const status = message.includes("not connected") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
