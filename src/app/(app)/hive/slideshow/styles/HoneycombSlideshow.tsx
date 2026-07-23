"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSlideshowDate } from "@/lib/hive/format";
import type { SlideshowPhoto, StyleSlideshowProps } from "../types";

const CELL_SWAP_MS = 2500;
const FEATURE_EVERY_MS = 12000;
const FEATURE_HOLD_MS = 5000;
const FEATURE_ANIM_MS = 700;

type CellState = {
  id: string;
  photo: SlideshowPhoto;
  fading: boolean;
  nextPhoto: SlideshowPhoto | null;
};

function pickPhoto(
  photos: SlideshowPhoto[],
  avoidId?: string,
): SlideshowPhoto {
  if (photos.length === 1) return photos[0]!;
  let choice = photos[Math.floor(Math.random() * photos.length)]!;
  let guard = 0;
  while (choice.id === avoidId && guard < 8) {
    choice = photos[Math.floor(Math.random() * photos.length)]!;
    guard += 1;
  }
  return choice;
}

function buildGrid(photos: SlideshowPhoto[], count: number): CellState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cell-${i}`,
    photo: photos[i % photos.length]!,
    fading: false,
    nextPhoto: null,
  }));
}

function useCellCount() {
  const [count, setCount] = useState(9);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const area = w * h;
      if (area < 500_000) setCount(7);
      else if (area < 900_000) setCount(9);
      else setCount(12);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return count;
}

export function HoneycombSlideshow({
  photos,
  paused,
  preload,
  refetchPhotos,
}: StyleSlideshowProps) {
  const cellCount = useCellCount();
  const [cells, setCells] = useState<CellState[]>(() =>
    buildGrid(photos, 9),
  );
  const [featured, setFeatured] = useState<{
    photo: SlideshowPhoto;
    open: boolean;
  } | null>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const featuredRef = useRef(featured);
  featuredRef.current = featured;
  const cycleRef = useRef(0);

  useEffect(() => {
    setCells((prev) => {
      if (prev.length === cellCount) return prev;
      return buildGrid(photosRef.current, cellCount);
    });
  }, [cellCount]);

  useEffect(() => {
    for (const cell of cells) {
      preload(cell.photo.displayUrl);
      if (cell.nextPhoto) preload(cell.nextPhoto.displayUrl);
    }
  }, [cells, preload]);

  const columns = useMemo(() => {
    if (cellCount <= 7) return 3;
    if (cellCount <= 9) return 4;
    return 5;
  }, [cellCount]);

  const swapRandomCell = useCallback(() => {
    const list = photosRef.current;
    if (list.length === 0 || featuredRef.current) return;

    setCells((prev) => {
      if (prev.length === 0) return prev;
      const idx = Math.floor(Math.random() * prev.length);
      const cell = prev[idx]!;
      const nextPhoto = pickPhoto(list, cell.photo.id);
      preload(nextPhoto.displayUrl);

      const withFade = prev.map((c, i) =>
        i === idx ? { ...c, fading: true, nextPhoto } : c,
      );

      window.setTimeout(() => {
        setCells((current) =>
          current.map((c) =>
            c.id === cell.id && c.nextPhoto
              ? {
                  ...c,
                  photo: c.nextPhoto,
                  nextPhoto: null,
                  fading: false,
                }
              : c,
          ),
        );
      }, 450);

      return withFade;
    });
  }, [preload]);

  const runFeature = useCallback(() => {
    if (featuredRef.current) return;
    const list = cellsRef.current;
    if (list.length === 0) return;
    const cell = list[Math.floor(Math.random() * list.length)]!;
    preload(cell.photo.displayUrl);
    setFeatured({ photo: cell.photo, open: false });

    const openTimer = window.setTimeout(() => {
      setFeatured((f) => (f ? { ...f, open: true } : null));
    }, 40);

    const closeTimer = window.setTimeout(() => {
      setFeatured((f) => (f ? { ...f, open: false } : null));
    }, FEATURE_ANIM_MS + FEATURE_HOLD_MS);

    const clearTimer = window.setTimeout(() => {
      setFeatured(null);
    }, FEATURE_ANIM_MS * 2 + FEATURE_HOLD_MS + 40);

    // Timers cleaned by next feature / unmount via interval clear only —
    // store on window is fine for slideshow lifetime.
    void openTimer;
    void closeTimer;
    void clearTimer;
  }, [preload]);

  useEffect(() => {
    if (paused || photos.length === 0) return;

    const swapId = window.setInterval(swapRandomCell, CELL_SWAP_MS);
    const featureId = window.setInterval(runFeature, FEATURE_EVERY_MS);

    const refetchId = window.setInterval(() => {
      cycleRef.current += 1;
      if (cycleRef.current % 8 === 0) {
        void refetchPhotos();
      }
    }, CELL_SWAP_MS);

    return () => {
      window.clearInterval(swapId);
      window.clearInterval(featureId);
      window.clearInterval(refetchId);
    };
  }, [paused, photos.length, swapRandomCell, runFeature, refetchPhotos]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141210]">
      <div
        className="absolute inset-0 flex items-center justify-center p-4 sm:p-8"
        style={{
          opacity: featured?.open ? 0.35 : 1,
          transition: `opacity ${FEATURE_ANIM_MS}ms ease`,
        }}
      >
        <div
          className="grid max-h-full max-w-5xl gap-2 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            width: "min(96vw, 1100px)",
          }}
        >
          {cells.map((cell, i) => {
            const row = Math.floor(i / columns);
            const offset = row % 2 === 1;
            return (
              <div
                key={cell.id}
                className="relative aspect-square"
                style={{
                  marginLeft: offset && i % columns === 0 ? "18%" : undefined,
                  transform: offset ? "translateX(12%)" : undefined,
                }}
              >
                <div
                  className="absolute inset-[4%] overflow-hidden bg-stone-800"
                  style={{
                    clipPath:
                      "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)",
                    boxShadow: "inset 0 0 0 1px rgba(244,180,0,0.28)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cell.photo.displayUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[450ms] ease-out"
                    style={{ opacity: cell.fading ? 0 : 1 }}
                    draggable={false}
                  />
                  {cell.nextPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cell.nextPhoto.displayUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[450ms] ease-out"
                      style={{ opacity: cell.fading ? 1 : 0 }}
                      draggable={false}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {featured && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6 sm:p-10"
          style={{
            opacity: featured.open ? 1 : 0,
            transition: `opacity ${FEATURE_ANIM_MS}ms ease`,
          }}
        >
          <div
            className="relative max-h-[88vh] max-w-[90vw] overflow-hidden rounded-lg shadow-[0_30px_80px_rgba(0,0,0,0.55)] will-change-transform"
            style={{
              transform: featured.open ? "scale(1)" : "scale(0.42)",
              transition: `transform ${FEATURE_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={featured.photo.displayUrl}
              alt={featured.photo.caption ?? "Guestbook photo"}
              className="max-h-[88vh] max-w-[90vw] object-contain"
              draggable={false}
            />
            {(featured.photo.caption ||
              formatSlideshowDate(
                featured.photo.taken_at ?? featured.photo.created_at,
              )) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-5 pb-5 pt-16">
                {featured.photo.caption && (
                  <p className="max-w-xl font-[family-name:var(--font-fraunces)] text-2xl font-medium text-[#F5EFE3]">
                    {featured.photo.caption}
                  </p>
                )}
                <p className="mt-1 text-sm text-[#F5EFE3]/70">
                  {formatSlideshowDate(
                    featured.photo.taken_at ?? featured.photo.created_at,
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
