import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchGuestbookPhotos } from "@/lib/photos";
import { GuestbookSlideshow } from "./GuestbookSlideshow";

export const metadata: Metadata = {
  title: "Guestbook slideshow",
};

export default async function HiveSlideshowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/hive/slideshow");
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    redirect("/hive");
  }

  const photos = await fetchGuestbookPhotos(propertyId);
  if (photos.length === 0) {
    redirect("/hive");
  }

  return (
    <GuestbookSlideshow
      initialPhotos={photos.map((p) => ({
        id: p.id,
        displayUrl: p.displayUrl,
        caption: p.caption,
        taken_at: p.taken_at,
        created_at: p.created_at,
      }))}
    />
  );
}
