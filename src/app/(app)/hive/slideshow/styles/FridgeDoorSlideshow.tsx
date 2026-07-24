"use client";

import { useEffect, useRef, useState } from "react";
import { guestbookTakenDateLabel } from "@/lib/hive/photo-labels";
import type { SlideshowPhoto, StyleSlideshowProps } from "../types";

const SWAP_MS = 6000;
const MAX_ON_DOOR = 8;
const FADE_OUT_MS = 650;

const MAGNET_COLORS = ["#E0972B", "#1A1714", "#C45C4A"] as const;

type PlacedShot = {
  key: string;
  photo: SlideshowPhoto;
  rotation: number;
  leftPct: number;
  topPct: number;
  heightVh: number;
  magnet: string;
  z: number;
  leaving?: boolean;
  entering?: boolean;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function placeShot(
  photo: SlideshowPhoto,
  z: number,
  existing: PlacedShot[],
): PlacedShot {
  const heightVh = randomBetween(26, 38);
  const widthGuess = heightVh * 0.78;
  let leftPct = randomBetween(4, 70);
  let topPct = randomBetween(6, 52);

  for (const other of existing.slice(-3)) {
    const dx = leftPct - other.leftPct;
    const dy = topPct - other.topPct;
    if (Math.hypot(dx, dy) < 16) {
      leftPct = Math.min(72, Math.max(4, leftPct + (dx >= 0 ? 14 : -14)));
      topPct = Math.min(54, Math.max(5, topPct + (dy >= 0 ? 12 : -12)));
    }
  }

  leftPct = Math.min(88 - widthGuess * 0.4, Math.max(3, leftPct));
  topPct = Math.min(68 - heightVh * 0.35, Math.max(4, topPct));

  return {
    key: `${photo.id}-${z}-${Math.random().toString(36).slice(2, 7)}`,
    photo,
    rotation: randomBetween(-3, 3),
    leftPct,
    topPct,
    heightVh,
    magnet: MAGNET_COLORS[Math.floor(Math.random() * MAGNET_COLORS.length)]!,
    z,
    entering: true,
  };
}

export function FridgeDoorSlideshow({
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
    setShots((prev) => {
      if (prev.length > 0) return prev;
      const seedCount = Math.min(MAX_ON_DOOR, photos.length, 5);
      const seeded: PlacedShot[] = [];
      for (let i = 0; i < seedCount; i++) {
        const photo = photos[i]!;
        preload(photo.displayUrl);
        seeded.push(placeShot(photo, zRef.current++, seeded));
      }
      return seeded.map((s) => ({ ...s, entering: false }));
    });
    cursorRef.current = Math.min(5, photos.length);
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

          if (updated.length > MAX_ON_DOOR) {
            const oldest = updated[0]!;
            updated = [{ ...oldest, leaving: true }, ...updated.slice(1)];
            window.setTimeout(() => {
              setShots((current) =>
                current.filter((s) => s.key !== oldest.key),
              );
            }, FADE_OUT_MS);
          }

          window.setTimeout(() => {
            setShots((current) =>
              current.map((s) =>
                s.key === next.key ? { ...s, entering: false } : s,
              ),
            );
          }, 50);

          return updated;
        });
      })();
    }, SWAP_MS);

    return () => window.clearInterval(id);
  }, [paused, photos.length, preload, refetchPhotos]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#F7F3EB]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 30% 20%, rgba(255,255,255,0.7), transparent 55%),
            radial-gradient(ellipse 70% 50% at 80% 80%, rgba(230,220,200,0.45), transparent 50%),
            linear-gradient(165deg, #FBF8F2 0%, #F0EBE0 48%, #E8E2D6 100%)
          `,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
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
              shot.leaving
                ? "fridge-fade-out"
                : shot.entering
                  ? "fridge-pin-in"
                  : ""
            }`}
            style={{
              left: `${shot.leftPct}%`,
              top: `${shot.topPct}%`,
              zIndex: shot.z,
              height: `${shot.heightVh}vh`,
              width: `${shot.heightVh * 0.78}vh`,
              ["--fridge-rot" as string]: `${shot.rotation}deg`,
              transform:
                shot.leaving || shot.entering
                  ? undefined
                  : `rotate(${shot.rotation}deg)`,
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            <div className="relative flex h-full flex-col rounded-[2px] bg-white p-2 pb-1 shadow-[0_10px_28px_rgba(26,23,20,0.18)]">
              <span
                className="absolute left-1/2 top-0 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: shot.magnet }}
                aria-hidden
              />
              <div className="relative min-h-0 flex-1 overflow-hidden bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.photo.displayUrl}
                  alt={shot.photo.caption ?? "Guestbook photo"}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="flex min-h-[2.5rem] flex-col justify-center px-1.5 py-1.5 text-center">
                {shot.photo.caption ? (
                  <>
                    <p className="line-clamp-2 font-[family-name:var(--font-corkboard)] text-[0.95rem] leading-snug text-stone-800 sm:text-base">
                      {shot.photo.caption}
                    </p>
                    {dateLabel ? (
                      <p className="mt-0.5 text-[0.65rem] tracking-wide text-stone-400">
                        {dateLabel}
                      </p>
                    ) : null}
                  </>
                ) : dateLabel ? (
                  <p className="font-[family-name:var(--font-corkboard)] text-sm text-stone-500">
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
