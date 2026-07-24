"use client";

import { useEffect, useRef, useState } from "react";
import { guestbookTakenDateLabel } from "@/lib/hive/photo-labels";
import type { SlideshowPhoto, StyleSlideshowProps } from "../types";

const DROP_MS = 5000;
const MAX_ON_TABLE = 6;
const FADE_OUT_MS = 700;

type PlacedShot = {
  key: string;
  photo: SlideshowPhoto;
  rotation: number;
  leftPct: number;
  topPct: number;
  heightVh: number;
  z: number;
  leaving?: boolean;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function placeShot(
  photo: SlideshowPhoto,
  z: number,
  existing: PlacedShot[],
): PlacedShot {
  const heightVh = randomBetween(30, 45);
  const widthGuess = heightVh * 0.75; // approx for centering math in vw terms
  let leftPct = randomBetween(8, 72);
  let topPct = randomBetween(6, 55);

  // Bias toward center, nudge away from recent shots.
  leftPct = leftPct * 0.55 + 22;
  topPct = topPct * 0.55 + 12;

  for (const other of existing.slice(-2)) {
    const dx = leftPct - other.leftPct;
    const dy = topPct - other.topPct;
    if (Math.hypot(dx, dy) < 18) {
      leftPct = Math.min(78, Math.max(6, leftPct + (dx >= 0 ? 16 : -16)));
      topPct = Math.min(58, Math.max(4, topPct + (dy >= 0 ? 14 : -14)));
    }
  }

  // Keep fully on-screen roughly.
  leftPct = Math.min(82 - widthGuess * 0.35, Math.max(4, leftPct));
  topPct = Math.min(70 - heightVh * 0.35, Math.max(4, topPct));

  return {
    key: `${photo.id}-${z}-${Math.random().toString(36).slice(2, 7)}`,
    photo,
    rotation: randomBetween(-8, 8),
    leftPct,
    topPct,
    heightVh,
    z,
  };
}

export function CorkboardSlideshow({
  photos,
  paused,
  preload,
  refetchPhotos,
}: StyleSlideshowProps) {
  const [shots, setShots] = useState<PlacedShot[]>([]);
  const cursorRef = useRef(0);
  const zRef = useRef(1);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    if (photos.length === 0) return;
    // Seed first shot immediately.
    setShots((prev) => {
      if (prev.length > 0) return prev;
      const first = photos[0]!;
      preload(first.displayUrl);
      return [placeShot(first, zRef.current++, [])];
    });
    cursorRef.current = Math.min(1, photos.length);
  }, [photos, preload]);

  useEffect(() => {
    if (paused || photos.length === 0) return;

    const id = window.setInterval(() => {
      void (async () => {
        let list = photosRef.current;
        if (cursorRef.current >= list.length) {
          list = await refetchPhotos();
          cursorRef.current = 0;
          if (list.length === 0) return;
        }

        const photo = list[cursorRef.current % list.length]!;
        cursorRef.current += 1;
        const upcoming = list[cursorRef.current % list.length];
        preload(photo.displayUrl);
        if (upcoming) preload(upcoming.displayUrl);

        setShots((prev) => {
          const active = prev.filter((s) => !s.leaving);
          const next = placeShot(photo, zRef.current++, active);
          let updated = [...active, next];

          if (updated.length > MAX_ON_TABLE) {
            const oldest = updated[0]!;
            updated = [
              { ...oldest, leaving: true },
              ...updated.slice(1),
            ];
            window.setTimeout(() => {
              setShots((current) =>
                current.filter((s) => s.key !== oldest.key),
              );
            }, FADE_OUT_MS);
          }

          return updated;
        });
      })();
    }, DROP_MS);

    return () => window.clearInterval(id);
  }, [paused, photos.length, preload, refetchPhotos]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#171310]">
      {/* Soft vignette / texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%), repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px)",
        }}
        aria-hidden
      />

      {shots.map((shot) => {
        const dateLabel = guestbookTakenDateLabel(
          shot.photo.taken_at,
          "slideshow",
        );
        return (
          <article
            key={shot.key}
            className={`absolute origin-center ${
              shot.leaving ? "corkboard-fade-out" : "corkboard-drop-in"
            }`}
            style={{
              left: `${shot.leftPct}%`,
              top: `${shot.topPct}%`,
              zIndex: shot.z,
              height: `${shot.heightVh}vh`,
              width: `${shot.heightVh * 0.78}vh`,
              ["--cork-rot" as string]: `${shot.rotation}deg`,
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            <div className="flex h-full flex-col rounded-[3px] bg-white p-2 pb-0 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
              <div className="relative min-h-0 flex-1 overflow-hidden bg-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.photo.displayUrl}
                  alt={shot.photo.caption ?? "Guestbook photo"}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="flex min-h-[3.25rem] flex-col justify-center px-2 py-2 text-center">
                {shot.photo.caption ? (
                  <>
                    <p className="line-clamp-2 font-[family-name:var(--font-corkboard)] text-[1.05rem] leading-snug text-stone-800 sm:text-lg">
                      {shot.photo.caption}
                    </p>
                    {dateLabel ? (
                      <p className="mt-0.5 text-[0.65rem] tracking-wide text-stone-400">
                        {dateLabel}
                      </p>
                    ) : null}
                  </>
                ) : dateLabel ? (
                  <p className="font-[family-name:var(--font-corkboard)] text-base text-stone-500">
                    {dateLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
