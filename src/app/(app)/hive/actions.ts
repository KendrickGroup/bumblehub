"use server";

import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  GUESTBOOK_BUCKET,
  guestbookStoragePath,
  isPropertyOwner,
  storagePathFromGuestbookUrl,
} from "@/lib/photos";

export type DeleteGuestbookResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteGuestbookPhoto(
  photoId: string,
): Promise<DeleteGuestbookResult> {
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

  if (!(await isPropertyOwner(propertyId, user.id))) {
    return { ok: false, error: "Only the home owner can remove guestbook photos." };
  }

  const { data: photo, error: fetchError } = await supabase
    .from("photos")
    .select("id, url, property_id, category")
    .eq("id", photoId)
    .eq("property_id", propertyId)
    .eq("category", "guestbook")
    .maybeSingle();

  if (fetchError || !photo) {
    return { ok: false, error: "Photo not found." };
  }

  const path =
    storagePathFromGuestbookUrl(photo.url) ??
    guestbookStoragePath(propertyId, photo.id);

  const { error: deleteRowError } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .eq("property_id", propertyId);

  if (deleteRowError) {
    return { ok: false, error: deleteRowError.message };
  }

  await supabase.storage.from(GUESTBOOK_BUCKET).remove([path]);

  return { ok: true };
}
