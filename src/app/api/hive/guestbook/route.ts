import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchGuestbookPhotos } from "@/lib/photos";

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
    return NextResponse.json({ photos: [] });
  }

  try {
    const photos = await fetchGuestbookPhotos(propertyId);
    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        displayUrl: p.displayUrl,
        caption: p.caption,
        taken_at: p.taken_at,
        created_at: p.created_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load guestbook";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
