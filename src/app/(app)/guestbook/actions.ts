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
  | { ok: true; url: string; photo: GuestbookPhoto }
  | { ok: false; error: string };

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
  // Client may pass EXIF / camera capture time. Absent or invalid → null
  // (do not use upload time — that lives in created_at).
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

  const photoId = crypto.randomUUID();
  const path = guestbookStoragePath(propertyId, photoId);

  const { error: uploadError } = await supabase.storage
    .from(GUESTBOOK_BUCKET)
    .upload(path, file, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
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
    })
    .select(
      "id, property_id, url, caption, taken_at, category, is_curated, created_by, created_at",
    )
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from(GUESTBOOK_BUCKET).remove([path]);
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
  };
}
