import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  CHART_ART_BUCKET,
  chartArtStoragePath,
  fetchChartArt,
  normalizeChartArtKey,
  saveChartArt,
} from "@/lib/radio/chart-art";

const NO_STORE = { "Cache-Control": "no-store" };

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
    return NextResponse.json({ chart_art: {}, hasProperty: false });
  }
  const chart_art = await fetchChartArt(supabase, propertyId);
  return NextResponse.json({ chart_art, hasProperty: true }, { headers: NO_STORE });
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

  const contentType = request.headers.get("content-type") ?? "";
  const art = await fetchChartArt(supabase, propertyId);

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const key = normalizeChartArtKey(String(form.get("key") ?? ""));
    const file = form.get("photo");
    if (!key) {
      return NextResponse.json({ error: "Unknown chart slot." }, { status: 400 });
    }
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    const path = chartArtStoragePath(propertyId, key);
    const { error: uploadError } = await supabase.storage
      .from(CHART_ART_BUCKET)
      .upload(path, file, { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(CHART_ART_BUCKET).getPublicUrl(path);
    const bust = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
    art[key] = bust;
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const action = (body as { action?: unknown }).action;
    if (action !== "remove") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    const key = normalizeChartArtKey(String((body as { key?: unknown }).key ?? ""));
    if (!key) {
      return NextResponse.json({ error: "Unknown chart slot." }, { status: 400 });
    }
    delete art[key];
    await supabase.storage
      .from(CHART_ART_BUCKET)
      .remove([chartArtStoragePath(propertyId, key)]);
  }

  try {
    const chart_art = await saveChartArt(supabase, propertyId, art);
    return NextResponse.json({ chart_art }, { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save." },
      { status: 500 },
    );
  }
}
