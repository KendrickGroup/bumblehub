import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isSpotifyConnected } from "@/lib/spotify/tokens";

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
    return NextResponse.json({
      connected: false,
      hasProperty: false,
      displayName: null,
      lastSyncedAt: null,
    });
  }

  const service = createServiceClient();
  const { data } = await service
    .from("integrations")
    .select("is_connected, display_name, last_synced_at, credentials")
    .eq("property_id", propertyId)
    .eq("integration_type", "spotify")
    .maybeSingle();

  const connected = await isSpotifyConnected(propertyId);

  return NextResponse.json({
    connected,
    hasProperty: true,
    displayName: data?.display_name ?? "Spotify",
    lastSyncedAt: data?.last_synced_at ?? null,
  });
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

  const action = (body as { action?: unknown }).action;
  if (action !== "disconnect") {
    return NextResponse.json(
      { error: "action must be disconnect" },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await service.from("integrations").upsert(
    {
      property_id: propertyId,
      integration_type: "spotify",
      display_name: "Spotify",
      credentials: {},
      is_connected: false,
      updated_at: now,
    },
    { onConflict: "property_id,integration_type" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connected: false });
}
