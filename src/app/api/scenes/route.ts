import { NextResponse } from "next/server";
import { requireHiveMember } from "@/lib/home-assistant/require-member";
import { listSceneActions, listScenes } from "@/lib/home-assistant/queries";

export async function GET() {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  try {
    const scenes = await listScenes(auth.propertyId);
    const actions = await listSceneActions(scenes.map((s) => s.id));
    return NextResponse.json({ scenes, actions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load scenes" },
      { status: 500 },
    );
  }
}
