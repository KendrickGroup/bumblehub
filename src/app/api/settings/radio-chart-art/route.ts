import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  CHART_ART_BUCKET,
  chartArtPublicUrl,
  chartArtStoragePath,
  chartArtStoragePaths,
  fetchChartArt,
  normalizeChartArtKey,
  saveChartArt,
  sniffChartArtType,
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

    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffChartArtType(bytes, file.type);
    if (!kind) {
      return NextResponse.json(
        { error: "Use a PNG, JPEG, or WebP image." },
        { status: 400 },
      );
    }
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const path = chartArtStoragePath(propertyId, key, kind.ext);
    await supabase.storage.from(CHART_ART_BUCKET).remove(chartArtStoragePaths(propertyId, key));
    const { error: uploadError } = await supabase.storage
      .from(CHART_ART_BUCKET)
      .upload(path, bytes, {
        contentType: kind.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(CHART_ART_BUCKET).getPublicUrl(path);
    art[key] = chartArtPublicUrl(publicUrl, hash);
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
      .remove(chartArtStoragePaths(propertyId, key));
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
