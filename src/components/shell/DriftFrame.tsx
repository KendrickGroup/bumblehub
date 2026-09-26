"use client";

import { useEffect, useState } from "react";
import { SCREENSAVER_BLACK_AFTER_MS } from "@/lib/idle/settings";

type FramePhoto = {
  id: string;
  displayUrl: string;
};

const SLIDE_MS = 8000;

export function DriftFrame({ onDismiss }: { onDismiss: () => void }) {
  const [photos, setPhotos] = useState<FramePhoto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [black, setBlack] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setBlack(true), SCREENSAVER_BLACK_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!black) return;
    document.documentElement.classList.add("screensaver-black");
    return () => {
      document.documentElement.classList.remove("screensaver-black");
    };
  }, [black]);

  useEffect(() => {
    if (black) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/hive/guestbook", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { photos?: FramePhoto[] };
        if (!cancelled) setPhotos(body.photos ?? []);
      } catch {
        if (!cancelled) setPhotos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [black]);

  useEffect(() => {
    if (black || !photos || photos.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % photos.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [black, photos]);

  useEffect(() => {
    if (photos && photos.length === 0) onDismiss();
  }, [photos, onDismiss]);

  if (black) {
    return (
      <button
        type="button"
        aria-label="Wake"
        className="fixed inset-0 z-[200] cursor-pointer border-0 bg-black p-0"
        onClick={onDismiss}
      />
    );
  }

  const photo = photos?.[index];

  return (
    <button
      type="button"
      aria-label="Back to the cabin"
      className="fixed inset-0 z-[200] cursor-pointer border-0 bg-[#141210] p-0"
      onClick={onDismiss}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.displayUrl}
          alt=""
          className="h-full w-full object-contain"
          decoding="async"
        />
      ) : null}
    </button>
  );
}
