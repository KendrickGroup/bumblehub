"use client";

import { useRouter } from "next/navigation";
import { Images } from "lucide-react";

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

async function requestFullscreen(el: HTMLElement): Promise<void> {
  const node = el as ElWithWebkit;
  try {
    if (typeof node.requestFullscreen === "function") {
      await node.requestFullscreen();
      return;
    }
    if (typeof node.webkitRequestFullscreen === "function") {
      await node.webkitRequestFullscreen();
      return;
    }
    if (typeof node.webkitRequestFullScreen === "function") {
      await node.webkitRequestFullScreen();
    }
  } catch {
    // Denied or unavailable — slideshow still works full-viewport.
  }
}

export function StartSlideshowButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          await requestFullscreen(document.documentElement);
          router.push("/hive/slideshow");
        })();
      }}
      className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-stone-900 px-5 text-base font-semibold text-white transition hover:bg-stone-800"
    >
      <Images className="h-5 w-5" strokeWidth={2} />
      Start slideshow
    </button>
  );
}
