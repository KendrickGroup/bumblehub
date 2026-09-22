"use client";

/**
 * Logs one impression per product per sitting, and only when the well was
 * genuinely on screen.
 *
 * "Visible" is three things: the strip intersects the viewport, the tab is
 * frontmost, and a hit test at the strip lands inside the strip — which is how
 * a banner sitting behind the expand card or a lightbox is told apart from one
 * a listener actually saw.
 */

import { useEffect, type RefObject } from "react";
import { noteImpression } from "./banner-log";

const VISIBLE_RATIO = 0.5;

function unobstructed(el: HTMLElement): boolean {
  const box = el.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return false;
  const x = box.left + box.width / 2;
  const y = box.top + Math.min(box.height / 2, 40);
  const top = document.elementFromPoint(x, y);
  return Boolean(top && el.contains(top));
}

export function useBannerImpression(
  ref: RefObject<HTMLElement | null>,
  handle: string,
  title: string,
  blocked: boolean,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !handle || blocked) return;

    let onScreen = false;
    const check = () => {
      if (!onScreen) return;
      if (document.visibilityState !== "visible") return;
      if (!unobstructed(el)) return;
      noteImpression(handle, title);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        onScreen = entry.intersectionRatio >= VISIBLE_RATIO;
        check();
      },
      { threshold: [0, VISIBLE_RATIO, 1] },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", check);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", check);
    };
  }, [ref, handle, title, blocked]);
}
