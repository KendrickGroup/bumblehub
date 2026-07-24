"use client";

import type { GuestbookPhoto } from "@/lib/photos";
import type { BoothBackdrop } from "@/lib/guestbook/backdrops";
import type { SlideshowStyle } from "@/lib/hive/slideshow-style";
import { SlideshowStyleSwitcher } from "@/components/hive/SlideshowStyleSwitcher";
import { MemoriesManager } from "./MemoriesManager";
import { PhotoBoothBackdropsPanel } from "./PhotoBoothBackdropsPanel";

type Props = {
  hasProperty: boolean;
  initialPhotos: GuestbookPhoto[];
  canDelete: boolean;
  initialSlideshowStyle: SlideshowStyle;
  initialBackdrops: BoothBackdrop[];
};

export function PhotoBoothSettingsSection({
  hasProperty,
  initialPhotos,
  canDelete,
  initialSlideshowStyle,
  initialBackdrops,
}: Props) {
  if (!hasProperty) {
    return (
      <section className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Set a default home to manage the Photo Booth.
      </section>
    );
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Photo Booth
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Memories on the wall, slideshow style, and booth backdrops. Guests only
        see the one-button booth.
      </p>

      <div className="mt-8">
        <MemoriesManager
          initialPhotos={initialPhotos}
          canDelete={canDelete}
        />
      </div>

      <div className="mt-10 border-t border-stone-100 pt-8">
        <h3 className="text-base font-semibold text-stone-900">
          Slideshow style
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          Used by “See our memories” and the idle slideshow.
        </p>
        <div className="mt-4">
          <SlideshowStyleSwitcher initialStyle={initialSlideshowStyle} />
        </div>
      </div>

      <div className="mt-10 border-t border-stone-100 pt-8">
        <PhotoBoothBackdropsPanel
          hasProperty={hasProperty}
          initialBackdrops={initialBackdrops}
        />
      </div>
    </section>
  );
}
