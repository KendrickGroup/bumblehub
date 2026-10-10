import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  CHART_ART_BUCKET,
  CHART_ART_MAX_BYTES,
  chartArtExtForType,
  chartArtPublicUrl,
  chartArtStoragePath,
  chartArtStoragePaths,
  fetchChartArt,
  normalizeChartArtKey,
  saveChartArt,
  sniffChartArtType,
  type ChartArtExt,
} from "@/lib/radio/chart-art";

const NO_STORE = { "Cache-Control": "no-store" };

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const rounded = mb >= 10 ? mb.toFixed(0) : mb.toFixed(1).replace(/\.0$/, "");
  return `${rounded} MB`;
}

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
    const payload = body as {
      action?: unknown;
      key?: unknown;
      contentType?: unknown;
      ext?: unknown;
      size?: unknown;
    };
    const action = payload.action;
    const key = normalizeChartArtKey(String(payload.key ?? ""));
    if (!key) {
      return NextResponse.json({ error: "Unknown chart slot." }, { status: 400 });
    }

    if (action === "sign") {
      const contentType = String(payload.contentType ?? "");
      const ext = chartArtExtForType(contentType);
      if (!ext) {
        return NextResponse.json(
          { error: "Use a PNG, JPEG, or WebP image." },
          { status: 400 },
        );
      }
      const size = Number(payload.size);
      if (!Number.isFinite(size) || size <= 0) {
        return NextResponse.json({ error: "No image provided." }, { status: 400 });
      }
      if (size > CHART_ART_MAX_BYTES) {
        return NextResponse.json(
          {
            error: `That image is ${formatMegabytes(size)}. Chart art has to be under ${formatMegabytes(CHART_ART_MAX_BYTES)}.`,
          },
          { status: 413 },
        );
      }
      const path = chartArtStoragePath(propertyId, key, ext);
      const service = createServiceClient();
      const signed = await service.storage
        .from(CHART_ART_BUCKET)
        .createSignedUploadUrl(path, { upsert: true });
      if (signed.error || !signed.data) {
        return NextResponse.json(
          { error: signed.error?.message ?? "Could not start the upload." },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { path: signed.data.path, token: signed.data.token },
        { headers: NO_STORE },
      );
    }

    if (action === "commit") {
      const ext = String(payload.ext ?? "") as ChartArtExt;
      if (ext !== "png" && ext !== "jpg" && ext !== "webp") {
        return NextResponse.json(
          { error: "Use a PNG, JPEG, or WebP image." },
          { status: 400 },
        );
      }
      const path = chartArtStoragePath(propertyId, key, ext);
      const service = createServiceClient();
      const listed = await service.storage
        .from(CHART_ART_BUCKET)
        .list(propertyId, { search: `${key}.${ext}`, limit: 20 });
      if (listed.error) {
        return NextResponse.json({ error: listed.error.message }, { status: 500 });
      }
      const landed = (listed.data ?? []).some((entry) => entry.name === `${key}.${ext}`);
      if (!landed) {
        return NextResponse.json(
          { error: "The image did not land in storage. Try the upload again." },
          { status: 400 },
        );
      }
      const siblings = chartArtStoragePaths(propertyId, key).filter((item) => item !== path);
      await service.storage.from(CHART_ART_BUCKET).remove(siblings);
      const {
        data: { publicUrl },
      } = service.storage.from(CHART_ART_BUCKET).getPublicUrl(path);
      art[key] = chartArtPublicUrl(publicUrl, Date.now().toString(36));
    } else if (action === "remove") {
      delete art[key];
      const service = createServiceClient();
      const { error: removeError } = await service.storage
        .from(CHART_ART_BUCKET)
        .remove(chartArtStoragePaths(propertyId, key));
      if (removeError) {
        return NextResponse.json({ error: removeError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
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
