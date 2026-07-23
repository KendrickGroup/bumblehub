import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Caveat } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchGuestbookPhotos } from "@/lib/photos";
import { parseSlideshowStyle } from "@/lib/hive/slideshow-style";
import { GuestbookSlideshow } from "./GuestbookSlideshow";

const corkboardFont = Caveat({
  subsets: ["latin"],
  variable: "--font-corkboard",
  weight: ["500", "600", "700"],
});

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

  const { data: settings } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  const style = parseSlideshowStyle(settings?.dashboard_layout);

  return (
    <div className={corkboardFont.variable}>
      <GuestbookSlideshow
        driftMode={driftMode}
        style={style}
        initialPhotos={photos.map((p) => ({
          id: p.id,
          displayUrl: p.displayUrl,
          caption: p.caption,
          taken_at: p.taken_at,
          created_at: p.created_at,
        }))}
      />
    </div>
  );
}
