"use server";

import { createClient } from "@/lib/supabase/server";
import {
  GUESTBOOK_BUCKET,
  guestbookStoragePath,
  isGuestbookBucketPublic,
  type GuestbookPhoto,
} from "@/lib/photos";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import type { Photo } from "@/lib/types";

export type SaveGuestbookResult =
  | {
      ok: true;
      url: string;
      photo: GuestbookPhoto;
      shareToken: string | null;
      shareUrl: string | null;
    }
  | { ok: false; error: string };

function randomShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveGuestbookPhoto(
  formData: FormData,
): Promise<SaveGuestbookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return { ok: false, error: "No active hive configured." };
  }

  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "No photo provided." };
  }

  const caption = String(formData.get("caption") ?? "").trim() || null;
  const takenAtRaw = String(formData.get("taken_at") ?? "").trim();
  let taken_at: string | null = null;
  if (takenAtRaw) {
    const parsed = new Date(takenAtRaw);
    if (!Number.isNaN(parsed.getTime())) {
      taken_at = parsed.toISOString();
    }
  }

  const categoryRaw = String(formData.get("category") ?? "guestbook").trim();
  const category =
    categoryRaw === "scrapbook" ? "scrapbook" : "guestbook";

  const watermarked = formData.get("watermarked");
  const hasCabinet =
    category === "guestbook" &&
    watermarked instanceof Blob &&
    watermarked.size > 0;

  const photoId = crypto.randomUUID();
  const path = guestbookStoragePath(propertyId, photoId);
  const cabinetPath = `${propertyId}/${photoId}-cabinet.jpg`;
  const share_token = hasCabinet ? randomShareToken() : null;

  const { error: uploadError } = await supabase.storage
    .from(GUESTBOOK_BUCKET)
    .upload(path, file, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  let watermarked_url: string | null = null;
  if (hasCabinet && watermarked instanceof Blob) {
    const { error: wmError } = await supabase.storage
      .from(GUESTBOOK_BUCKET)
      .upload(cabinetPath, watermarked, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (wmError) {
      await supabase.storage.from(GUESTBOOK_BUCKET).remove([path]);
      return { ok: false, error: wmError.message };
    }
    const {
      data: { publicUrl: wmPublic },
    } = supabase.storage.from(GUESTBOOK_BUCKET).getPublicUrl(cabinetPath);
    watermarked_url = wmPublic;
    if (!isGuestbookBucketPublic()) {
      const { data } = await supabase.storage
        .from(GUESTBOOK_BUCKET)
        .createSignedUrl(cabinetPath, 60 * 60 * 24 * 365);
      if (data?.signedUrl) watermarked_url = data.signedUrl;
    }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(GUESTBOOK_BUCKET).getPublicUrl(path);

  const { data: inserted, error: insertError } = await supabase
    .from("photos")
    .insert({
      id: photoId,
      property_id: propertyId,
      url: publicUrl,
      caption,
      category,
      taken_at,
      created_by: user.id,
      share_token,
      watermarked_url,
    })
    .select(
      "id, property_id, url, caption, taken_at, category, is_curated, created_by, created_at, share_token, watermarked_url",
    )
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from(GUESTBOOK_BUCKET).remove([path]);
    if (hasCabinet) {
      await supabase.storage.from(GUESTBOOK_BUCKET).remove([cabinetPath]);
    }
    return { ok: false, error: insertError?.message ?? "Failed to save photo." };
  }

  const row = inserted as Photo;
  let displayUrl = row.url;
  if (!isGuestbookBucketPublic()) {
    const { data } = await supabase.storage
      .from(GUESTBOOK_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6);
    if (data?.signedUrl) displayUrl = data.signedUrl;
  }

  return {
    ok: true,
    url: publicUrl,
    photo: { ...row, displayUrl },
    shareToken: share_token,
    shareUrl: share_token ? `/p/${share_token}` : null,
  };
}
