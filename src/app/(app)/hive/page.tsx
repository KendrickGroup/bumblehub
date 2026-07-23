import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Images, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  fetchGuestbookPhotos,
  isPropertyOwner,
} from "@/lib/photos";
import { GuestbookCard } from "./GuestbookCard";

export const metadata: Metadata = {
  title: "Hive",
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

  return (
    <div className="px-2 py-6 sm:px-0">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          Hive
        </p>
        <h1
          className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900 sm:text-4xl"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          Hive
        </h1>
        <p className="mt-2 max-w-lg text-base text-stone-600">
          The people who&apos;ve been here.
        </p>
      </header>

      {!propertyId ? (
        <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Set a default hive in{" "}
          <code className="font-mono text-xs">user_settings</code> to use the
          guestbook.
        </p>
      ) : (
        <>
          <div className="mb-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/guestbook"
              className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-[#F4B400] px-5 text-base font-semibold text-stone-900 transition hover:bg-[#e0a800]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
              Add to the guestbook
            </Link>
            <Link
              href="/hive/slideshow"
              className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-stone-900 px-5 text-base font-semibold text-white transition hover:bg-stone-800"
            >
              <Images className="h-5 w-5" strokeWidth={2} />
              Start slideshow
            </Link>
          </div>

          {photos.length === 0 ? (
            <div className="flex flex-col items-center rounded-[20px] bg-white px-6 py-14 text-center shadow-sm">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#F4B400]/15 text-[#F4B400]">
                <Camera className="h-8 w-8" strokeWidth={1.75} />
              </span>
              <p className="text-lg font-semibold text-stone-900">
                The guestbook is empty. Be the first!
              </p>
              <p className="mt-2 max-w-sm text-sm text-stone-500">
                Snap a selfie and leave a note for the hive slideshow.
              </p>
              <Link
                href="/guestbook"
                className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-[18px] bg-[#F4B400] px-6 text-base font-semibold text-stone-900 hover:bg-[#e0a800]"
              >
                Add to the guestbook
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <GuestbookCard
                  key={photo.id}
                  photo={photo}
                  canDelete={canDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
