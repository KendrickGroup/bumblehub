import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  fetchGuestbookPhotos,
  isPropertyOwner,
} from "@/lib/photos";
import {
  DEFAULT_SLIDESHOW_STYLE,
  parseSlideshowStyle,
} from "@/lib/hive/slideshow-style";
import { SlideshowStyleSwitcher } from "@/components/hive/SlideshowStyleSwitcher";
import { GuestbookGallery } from "./GuestbookGallery";

export const metadata: Metadata = {
  title: "Guestbook",
};

export default async function HivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  const photos = propertyId ? await fetchGuestbookPhotos(propertyId) : [];
  const canDelete =
    !!user && !!propertyId
      ? await isPropertyOwner(propertyId, user.id)
      : false;

  let slideshowStyle = DEFAULT_SLIDESHOW_STYLE;
  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    slideshowStyle = parseSlideshowStyle(data?.dashboard_layout);
  }

  return (
    <div className="px-2 py-6 sm:px-0">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          Guestbook
        </p>
        <h1
          className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900 sm:text-4xl"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          Guestbook
        </h1>
        <p className="mt-2 max-w-lg text-base text-stone-600">
          The people who&apos;ve been here.
        </p>
      </header>

      {!propertyId ? (
        <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Set a default home in{" "}
          <code className="font-mono text-xs">user_settings</code> to use the
          guestbook.
        </p>
      ) : (
        <>
          <div className="mb-8 rounded-[18px] bg-white px-4 py-3 shadow-sm sm:px-5">
            <SlideshowStyleSwitcher
              initialStyle={slideshowStyle}
              compact
            />
          </div>

          <GuestbookGallery
            initialPhotos={photos}
            canDelete={canDelete}
          />
        </>
      )}
    </div>
  );
}
