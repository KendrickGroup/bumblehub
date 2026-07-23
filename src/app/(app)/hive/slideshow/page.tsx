import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchGuestbookPhotos } from "@/lib/photos";
import { GuestbookSlideshow } from "./GuestbookSlideshow";

export const metadata: Metadata = {
  title: "Guestbook slideshow",
};

type Props = {
  searchParams: Promise<{ drift?: string }>;
};

export default async function HiveSlideshowPage({ searchParams }: Props) {
  const { drift } = await searchParams;
  const driftMode = drift === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/hive/slideshow");
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    redirect(driftMode ? "/home" : "/hive");
  }

  const photos = await fetchGuestbookPhotos(propertyId);
  if (photos.length === 0) {
    redirect(driftMode ? "/home" : "/hive");
  }

  return (
    <GuestbookSlideshow
      driftMode={driftMode}
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
