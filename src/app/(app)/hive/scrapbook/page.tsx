import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchGuestbookPhotos } from "@/lib/photos";
import { ScrapbookEditor } from "./ScrapbookEditor";

export const metadata: Metadata = {
  title: "Scrapbook",
};

export default async function ScrapbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  const photos = propertyId ? await fetchGuestbookPhotos(propertyId) : [];

  return (
    <ScrapbookEditor
      photos={photos}
      hasProperty={!!propertyId}
    />
  );
}
