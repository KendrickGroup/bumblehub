import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireHiveMember } from "@/lib/home-assistant/require-member";
import { listDevices } from "@/lib/home-assistant/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing device id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as { name?: unknown; room_id?: unknown };
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.name === "string") {
    const name = payload.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    patch.name = name;
  }

  if (payload.room_id === null) {
    patch.room_id = null;
  } else if (typeof payload.room_id === "string") {
    patch.room_id = payload.room_id || null;
  }

  const service = createServiceClient();
  const { error } = await service
    .from("devices")
    .update(patch)
    .eq("id", id)
    .eq("property_id", auth.propertyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const devices = await listDevices(auth.propertyId);
  const device = devices.find((d) => d.id === id);
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  return NextResponse.json({ device });
}
