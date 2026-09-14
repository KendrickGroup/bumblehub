import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireHiveMember } from "@/lib/home-assistant/require-member";
import { listScenes } from "@/lib/home-assistant/queries";

export async function PATCH(request: Request) {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  const service = createServiceClient();
  const existing = await listScenes(auth.propertyId);
  const allowed = new Set(existing.map((s) => s.id));

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id || !allowed.has(id)) continue;

    const patch: Record<string, unknown> = {};
    if (typeof item.is_enabled === "boolean") patch.is_enabled = item.is_enabled;
    if (typeof item.display_order === "number" && Number.isFinite(item.display_order)) {
      patch.display_order = Math.round(item.display_order);
    }
    if (typeof item.description === "string") {
      const description = item.description.trim();
      patch.description = description.length > 0 ? description : null;
    }
    if (Object.keys(patch).length === 0) continue;

    const { error } = await service.from("scenes").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const scenes = await listScenes(auth.propertyId);
  return NextResponse.json({ scenes });
}
