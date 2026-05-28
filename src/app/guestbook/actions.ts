"use server";

import { createClient } from "@/lib/supabase/server";
import {
  GUESTBOOK_BUCKET,
  guestbookStoragePath,
} from "@/lib/photos";
import { getDefaultPropertyIdForUser } from "@/lib/property";

export type SaveGuestbookResult =
  | { ok: true; url: string }
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

  const { error: insertError } = await supabase.from("photos").insert({
    property_id: propertyId,
    url: publicUrl,
    caption,
    category: "guestbook",
    taken_at: new Date().toISOString(),
    created_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from(GUESTBOOK_BUCKET).remove([path]);
    return { ok: false, error: insertError.message };
  }

  return { ok: true, url: publicUrl };
}
