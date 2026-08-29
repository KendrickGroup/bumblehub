import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireHiveMember } from "@/lib/home-assistant/require-member";
import { markHomeAssistantSynced } from "@/lib/home-assistant/tokens";
import { listDevices, listRooms } from "@/lib/home-assistant/queries";
import type { DeviceType } from "@/lib/types";

const DEVICE_TYPES = new Set<DeviceType>([
  "light",
  "switch",
  "plug",
  "thermostat",
  "camera",
  "lock",
  "sensor",
  "speaker",
  "tv",
  "other",
]);

export async function GET() {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  try {
    const [devices, rooms] = await Promise.all([
      listDevices(auth.propertyId),
      listRooms(auth.propertyId),
    ]);
    return NextResponse.json({ devices, rooms });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load devices" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = (body as { devices?: unknown }).devices;
  if (!Array.isArray(items)) {
    return NextResponse.json(
      { error: "devices must be an array" },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  const { data: existingRows, error: existingError } = await service
    .from("devices")
    .select("id, external_id, name, room_id, display_order")
    .eq("property_id", auth.propertyId)
    .eq("protocol", "home_assistant");

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const byExternalId = new Map(
    (existingRows ?? [])
      .filter((row) => typeof row.external_id === "string")
      .map((row) => [row.external_id as string, row]),
  );

  const seen = new Set<string>();
  let order = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const externalId =
      typeof item.external_id === "string" ? item.external_id.trim() : "";
    if (!externalId) continue;
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : externalId;
    const deviceType = DEVICE_TYPES.has(item.device_type as DeviceType)
      ? (item.device_type as DeviceType)
      : "other";
    const capabilities =
      item.capabilities && typeof item.capabilities === "object"
        ? item.capabilities
        : {};
    const metadata =
      item.metadata && typeof item.metadata === "object" ? item.metadata : {};

    seen.add(externalId);
    const existing = byExternalId.get(externalId);

    if (existing) {
      const { error } = await service
        .from("devices")
        .update({
          device_type: deviceType,
          capabilities,
          metadata,
          is_active: true,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await service.from("devices").insert({
        property_id: auth.propertyId,
        room_id: null,
        name,
        device_type: deviceType,
        protocol: "home_assistant",
        external_id: externalId,
        capabilities,
        metadata,
        is_active: true,
        display_order: order,
        created_at: now,
        updated_at: now,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    order += 1;
  }

  const staleIds = (existingRows ?? [])
    .filter(
      (row) =>
        typeof row.external_id === "string" && !seen.has(row.external_id),
    )
    .map((row) => row.id);

  if (staleIds.length > 0) {
    await service
      .from("devices")
      .update({ is_active: false, updated_at: now })
      .in("id", staleIds);
  }

  try {
    await markHomeAssistantSynced(auth.propertyId);
  } catch {
    // Token row may not exist yet; devices still saved.
  }

  const [devices, rooms] = await Promise.all([
    listDevices(auth.propertyId),
    listRooms(auth.propertyId),
  ]);

  return NextResponse.json({ devices, rooms });
}
