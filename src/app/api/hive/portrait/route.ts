import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PortraitFinish } from "@/lib/guestbook/finish";
import { compositePortrait } from "@/lib/guestbook/portrait-server";
import type { ParlorSceneId } from "@/lib/guestbook/parlor-scenes";

export const runtime = "nodejs";
export const maxDuration = 15;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const MAX_BYTES = 8_000_000;

const SCENES = new Set<ParlorSceneId>(["saloon", "ok-corral", "barn"]);
const FINISHES = new Set<PortraitFinish>(["color", "sepia", "tintype"]);

/** Per signed-in user, per warm instance. A pose is occasional; this only
 *  stops a script from hammering one lambda. */
const attempts = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  attempts.set(userId, recent);
  if (attempts.size > 2000) {
    for (const [key, times] of attempts) {
      if (times.every((at) => now - at >= WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function isScene(value: string): value is ParlorSceneId {
  return SCENES.has(value as ParlorSceneId);
}

function isFinish(value: string): value is PortraitFinish {
  return FINISHES.has(value as PortraitFinish);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many portraits. Give it a few minutes." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a portrait." }, { status: 400 });
  }

  const sceneRaw = String(form.get("scene") ?? "");
  const finishRaw = String(form.get("finish") ?? "");
  const image = form.get("image");

  if (!isScene(sceneRaw) || !isFinish(finishRaw)) {
    return NextResponse.json({ error: "Unknown scene or finish." }, { status: 400 });
  }
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Missing still." }, { status: 400 });
  }
  if (image.size <= 0 || image.size > MAX_BYTES) {
    return NextResponse.json({ error: "That still is the wrong size." }, { status: 413 });
  }
  if (image.type && !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "Expected an image." }, { status: 400 });
  }

  try {
    const still = Buffer.from(await image.arrayBuffer());
    const result = await compositePortrait(still, sceneRaw, finishRaw);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Kept the framed shot." },
        { status: 422 },
      );
    }

    console.info(
      `[portrait] ${result.ms}ms scene=${sceneRaw} finish=${finishRaw} bytes=${result.jpeg.length}`,
    );

    return new NextResponse(new Uint8Array(result.jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Portrait-Ms": String(result.ms),
      },
    });
  } catch (error) {
    console.error("[portrait] failed", error);
    return NextResponse.json({ error: "Could not develop the portrait." }, { status: 500 });
  }
}
