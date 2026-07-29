import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Photo } from "@/lib/types";

export const GUESTBOOK_BUCKET = "guestbook";

/** Migration configures this bucket as public. Override with GUESTBOOK_BUCKET_PUBLIC=false if private. */
export function isGuestbookBucketPublic(): boolean {
  const override = process.env.GUESTBOOK_BUCKET_PUBLIC?.trim().toLowerCase();
  if (override === "false" || override === "0") return false;
  if (override === "true" || override === "1") return true;
  // Default matches supabase/migrations/00000000000002_guestbook_storage.sql
  return true;
}

export function guestbookStoragePath(propertyId: string, photoId: string): string {
  return `${propertyId}/${photoId}.jpg`;
}

export function storagePathFromGuestbookUrl(url: string): string | null {
  const marker = `/object/public/${GUESTBOOK_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]!);
  }
  const signedMarker = `/object/sign/${GUESTBOOK_BUCKET}/`;
  const signedIdx = url.indexOf(signedMarker);
  if (signedIdx >= 0) {
    return decodeURIComponent(
      url.slice(signedIdx + signedMarker.length).split("?")[0]!,
    );
  }
  return null;
}

export type GuestbookPhoto = Photo & {
  displayUrl: string;
};

/** Guestbook booth snaps and scrapbook pages on the wall. */
export const WALL_PHOTO_CATEGORIES = ["guestbook", "scrapbook"] as const;

export async function fetchGuestbookPhotos(
  propertyId: string,
): Promise<GuestbookPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, property_id, url, caption, taken_at, category, is_curated, created_by, created_at",
    )
    .eq("property_id", propertyId)
    .in("category", [...WALL_PHOTO_CATEGORIES])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Photo[];
  return resolveGuestbookDisplayUrls(rows);
}

async function resolveGuestbookDisplayUrls(
  photos: Photo[],
): Promise<GuestbookPhoto[]> {
  if (photos.length === 0) return [];

  if (isGuestbookBucketPublic()) {
    return photos.map((photo) => ({ ...photo, displayUrl: photo.url }));
  }

  const supabase = await createClient();
  const resolved: GuestbookPhoto[] = [];

  for (const photo of photos) {
    const path =
      storagePathFromGuestbookUrl(photo.url) ??
      (photo.property_id
        ? guestbookStoragePath(photo.property_id, photo.id)
        : null);

    if (!path) {
      resolved.push({ ...photo, displayUrl: photo.url });
      continue;
    }

    const { data, error } = await supabase.storage
      .from(GUESTBOOK_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6);

    resolved.push({
      ...photo,
      displayUrl: error || !data?.signedUrl ? photo.url : data.signedUrl,
    });
  }

  return resolved;
}

export async function isPropertyOwner(
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_members")
    .select("role")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "owner";
}

/** Best-effort bucket visibility probe for ops/logging (service role). */
export async function probeGuestbookBucketPublic(): Promise<boolean | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.getBucket(GUESTBOOK_BUCKET);
    if (error || !data) return null;
    return Boolean(data.public);
  } catch {
    return null;
  }
}
