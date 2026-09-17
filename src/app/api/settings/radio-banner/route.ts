import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { sniffChartArtType } from "@/lib/radio/chart-art";
import {
  BANNER_ART_BUCKET,
  BANNER_MAX_IMAGES,
  bannerPublicUrl,
  bannerStoragePath,
  fetchBanner,
  normalizeBannerLines,
  saveBannerLayout,
  storagePathFromBannerUrl,
} from "@/lib/radio/banner";

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
    return NextResponse.json({
      banner_images: [],
      banner_lines: [],
      hasProperty: false,
    });
  }
  const banner = await fetchBanner(supabase, propertyId);
  return NextResponse.json(
    {
      banner_images: banner.images,
      banner_lines: banner.lines,
      hasProperty: true,
    },
    { headers: NO_STORE },
  );
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
  const current = await fetchBanner(supabase, propertyId);

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const blobs = [...form.getAll("photos"), ...form.getAll("photo")].filter(
      (item): item is File => item instanceof File && item.size > 0,
    );

    if (blobs.length === 0) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    const images = [...current.images];
    for (const file of blobs) {
      if (images.length >= BANNER_MAX_IMAGES) break;
      const bytes = Buffer.from(await file.arrayBuffer());
      const kind = sniffChartArtType(bytes, file.type);
      if (!kind) {
        return NextResponse.json(
          { error: "Use a PNG, JPEG, or WebP image." },
          { status: 400 },
        );
      }
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
      const path = bannerStoragePath(propertyId, randomUUID(), kind.ext);
      const { error: uploadError } = await supabase.storage
        .from(BANNER_ART_BUCKET)
        .upload(path, bytes, {
          contentType: kind.contentType,
          upsert: false,
          cacheControl: "31536000",
        });
      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from(BANNER_ART_BUCKET).getPublicUrl(path);
      images.push(bannerPublicUrl(publicUrl, hash));
    }

    try {
      const banner = await saveBannerLayout(supabase, propertyId, { images });
      return NextResponse.json(
        { banner_images: banner.images, banner_lines: banner.lines },
        { headers: NO_STORE },
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save." },
        { status: 500 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = (body as { action?: unknown }).action;
  if (action === "remove") {
    const url = String((body as { url?: unknown }).url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "Missing image." }, { status: 400 });
    }
    const images = current.images.filter((item) => item !== url);
    const path = storagePathFromBannerUrl(url);
    if (path) {
      await supabase.storage.from(BANNER_ART_BUCKET).remove([path]);
    }
    try {
      const banner = await saveBannerLayout(supabase, propertyId, { images });
      return NextResponse.json(
        { banner_images: banner.images, banner_lines: banner.lines },
        { headers: NO_STORE },
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save." },
        { status: 500 },
      );
    }
  }

  if (action === "lines") {
    const lines = normalizeBannerLines((body as { lines?: unknown }).lines);
    try {
      const banner = await saveBannerLayout(supabase, propertyId, { lines });
      return NextResponse.json(
        { banner_images: banner.images, banner_lines: banner.lines },
        { headers: NO_STORE },
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
