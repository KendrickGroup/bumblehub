import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  GUESTBOOK_BUCKET,
  isGuestbookBucketPublic,
} from "@/lib/photos";
import { parseCustomBackdrops } from "@/lib/guestbook/backdrops";

async function loadLayout(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  return data?.dashboard_layout && typeof data.dashboard_layout === "object"
    ? { ...(data.dashboard_layout as Record<string, unknown>) }
    : {};
}

async function saveLayout(
  propertyId: string,
  layout: Record<string, unknown>,
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  return supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: now,
    },
    { onConflict: "property_id" },
  );
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
    return NextResponse.json({ backdrops: [], hasProperty: false });
  }

  const layout = await loadLayout(propertyId);
  return NextResponse.json({
    backdrops: parseCustomBackdrops(layout),
    hasProperty: true,
  });
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
  const layout = await loadLayout(propertyId);
  let backdrops = parseCustomBackdrops(layout);

  if (contentType.includes("multipart/form-data")) {
    if (backdrops.length >= 6) {
      return NextResponse.json(
        { error: "You can upload up to 6 custom backdrops." },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    // Server can't run browser canvas downscale — accept JPEG/PNG/webp as uploaded.
    // Client should downscale before upload.
    const id = crypto.randomUUID();
    const path = `${propertyId}/backdrops/${id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(GUESTBOOK_BUCKET)
      .upload(path, file, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(GUESTBOOK_BUCKET).getPublicUrl(path);

    let url = publicUrl;
    if (!isGuestbookBucketPublic()) {
      const { data } = await supabase.storage
        .from(GUESTBOOK_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (data?.signedUrl) url = data.signedUrl;
    }

    const label = String(form.get("label") ?? "").trim() || "Custom";
    backdrops = [
      ...backdrops,
      { id, label: label.slice(0, 40), url, builtin: false as const },
    ];
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = (body as { action?: unknown }).action;
    if (action === "remove") {
      const id = (body as { id?: unknown }).id;
      if (typeof id !== "string") {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      const removed = backdrops.find((b) => b.id === id);
      backdrops = backdrops.filter((b) => b.id !== id);
      if (removed) {
        const path = `${propertyId}/backdrops/${id}.jpg`;
        await supabase.storage.from(GUESTBOOK_BUCKET).remove([path]);
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  }

  layout.guestbook_backdrops = backdrops.map(({ id, label, url }) => ({
    id,
    label,
    url,
  }));

  const { error } = await saveLayout(propertyId, layout);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ backdrops });
}
