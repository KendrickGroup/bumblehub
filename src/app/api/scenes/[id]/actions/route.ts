import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireHiveMember } from "@/lib/home-assistant/require-member";
import { listSceneActions, listScenes } from "@/lib/home-assistant/queries";
import type { DeviceActionPayload } from "@/lib/types";

function parseDeviceAction(
  raw: unknown,
  index: number,
): {
  device_id: string | null;
  payload: DeviceActionPayload;
  delay_seconds: number;
  display_order: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const payloadObj =
    item.payload && typeof item.payload === "object"
      ? (item.payload as Record<string, unknown>)
      : null;
  const entityId =
    typeof payloadObj?.entity_id === "string"
      ? payloadObj.entity_id.trim()
      : "";
  const service = payloadObj?.service;
  if (
    !payloadObj ||
    !entityId ||
    (service !== "turn_on" && service !== "turn_off")
  ) {
    return null;
  }

  const data: DeviceActionPayload["data"] = {};
  const dataRaw =
    payloadObj.data && typeof payloadObj.data === "object"
      ? (payloadObj.data as { brightness_pct?: unknown })
      : undefined;
  const brightness = dataRaw?.brightness_pct;
  if (
    service === "turn_on" &&
    typeof brightness === "number" &&
    Number.isFinite(brightness)
  ) {
    data.brightness_pct = Math.max(0, Math.min(100, Math.round(brightness)));
  }

  return {
    device_id: typeof item.device_id === "string" ? item.device_id : null,
    payload: {
      entity_id: entityId,
      service,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    },
    delay_seconds:
      typeof item.delay_seconds === "number" && item.delay_seconds > 0
        ? Math.round(item.delay_seconds)
        : 0,
    display_order:
      typeof item.display_order === "number"
        ? item.display_order
        : index,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  const { id: sceneId } = await params;
  const scenes = await listScenes(auth.propertyId);
  if (!scenes.some((s) => s.id === sceneId)) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = (body as { actions?: unknown }).actions;
  if (!Array.isArray(incoming)) {
    return NextResponse.json(
      { error: "actions must be an array" },
      { status: 400 },
    );
  }

  const parsed = incoming
    .map((item, index) => parseDeviceAction(item, index))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const service = createServiceClient();

  const { error: deleteError } = await service
    .from("scene_actions")
    .delete()
    .eq("scene_id", sceneId)
    .eq("action_type", "set_device_state");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (parsed.length > 0) {
    const { error: insertError } = await service.from("scene_actions").insert(
      parsed.map((item, index) => ({
        scene_id: sceneId,
        action_type: "set_device_state",
        device_id: item.device_id,
        payload: item.payload,
        delay_seconds: item.delay_seconds,
        display_order: item.display_order || index,
      })),
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const actions = await listSceneActions([sceneId]);
  return NextResponse.json({ actions });
}
