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

export type UpdateGuestbookResult =
  | {
      ok: true;
      photo: {
        id: string;
        caption: string | null;
        taken_at: string | null;
      };
    }
  | { ok: false; error: string };

/** Any hive member may edit caption / taken_at (warm, non-destructive). */
export async function updateGuestbookPhoto(input: {
  photoId: string;
  caption: string | null;
  taken_at: string | null;
}): Promise<UpdateGuestbookResult> {
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

  const caption =
    input.caption == null ? null : String(input.caption).trim() || null;

  let taken_at: string | null = null;
  if (input.taken_at) {
    const parsed = new Date(input.taken_at);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Invalid date." };
    }
    taken_at = parsed.toISOString();
  }

  const { data, error } = await supabase
    .from("photos")
    .update({ caption, taken_at })
    .eq("id", input.photoId)
    .eq("property_id", propertyId)
    .eq("category", "guestbook")
    .select("id, caption, taken_at")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Photo not found." };
  }

  return {
    ok: true,
    photo: {
      id: data.id as string,
      caption: (data.caption as string | null) ?? null,
      taken_at: (data.taken_at as string | null) ?? null,
    },
  };
}

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
