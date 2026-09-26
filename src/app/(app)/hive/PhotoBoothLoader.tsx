"use client";

import dynamic from "next/dynamic";

const PhotoBooth = dynamic<{ hasProperty: boolean }>(
  () => import("./PhotoBooth").then((mod) => mod.PhotoBooth),
  {
    ssr: false,
    loading: () => (
      <p className="px-2 py-10 text-center text-sm text-[#5C4430]">
        Warming up the box…
      </p>
    ),
  },
);

export function PhotoBoothLoader({ hasProperty }: { hasProperty: boolean }) {
  return <PhotoBooth hasProperty={hasProperty} />;
}
