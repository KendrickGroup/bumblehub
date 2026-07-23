"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSlideshowDate } from "@/lib/hive/format";
import type { StyleSlideshowProps } from "../types";

const SLIDE_MS = 8000;
const FADE_MS = 1000;

type KenBurns = {
  from: string;
  to: string;
};

const PAN_DRIFTS: Array<[number, number]> = [
  [3.2, 0],
  [-3.2, 0],
  [0, 2.8],
  [0, -2.8],
  [2.6, 2.2],
  [-2.6, 2.2],
  [2.6, -2.2],
  [-2.6, -2.2],
  [3.5, 1.2],
  [-3.5, -1.2],
];

function buildKenBurns(zoomIn: boolean): KenBurns {
  const [dx, dy] =
    PAN_DRIFTS[Math.floor(Math.random() * PAN_DRIFTS.length)]!;
  const scaleMin = 1.0;
  const scaleMax = 1.12;

  if (zoomIn) {
    return {
      from: `scale(${scaleMin}) translate(0%, 0%)`,
      to: `scale(${scaleMax}) translate(${dx}%, ${dy}%)`,
    };
  }

  return {
    from: `scale(${scaleMax}) translate(${dx}%, ${dy}%)`,
    to: `scale(${scaleMin}) translate(0%, 0%)`,
  };
}

export function GallerySlideshow({
  photos,
  paused,
  preload,
  refetchPhotos,
}: StyleSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const zoomInRef = useRef(true);
  const [kenBurns, setKenBurns] = useState<KenBurns>(() =>
    buildKenBurns(true),
  );
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const indexRef = useRef(index);
  indexRef.current = index;

  const advanceKenBurns = useCallback(() => {
    const zoomIn = zoomInRef.current;
    zoomInRef.current = !zoomIn;
    return buildKenBurns(zoomIn);
  }, []);

  useEffect(() => {
    if (paused || photos.length === 0) return;

    const current = photos[index];
    const upcoming = photos[(index + 1) % photos.length];
    if (current) preload(current.displayUrl);
    if (upcoming) preload(upcoming.displayUrl);

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, SLIDE_MS - FADE_MS);

    const advanceTimer = window.setTimeout(() => {
      void (async () => {
        const atEnd = indexRef.current >= photosRef.current.length - 1;
        if (atEnd) {
          const next = await refetchPhotos();
          if (next.length === 0) return;
          setKenBurns(advanceKenBurns());
          setIndex(0);
          setVisible(true);
          return;
        }
        setKenBurns(advanceKenBurns());
        setIndex((i) => (i + 1) % photosRef.current.length);
        setVisible(true);
      })();
    }, SLIDE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [index, photos, paused, preload, refetchPhotos, advanceKenBurns]);

  // Keep index valid if photo list shrinks.
  useEffect(() => {
    if (index >= photos.length) setIndex(0);
  }, [photos.length, index]);

  const photo = photos[index];
  if (!photo) return null;

  const dateLabel = formatSlideshowDate(photo.taken_at ?? photo.created_at);

  return (
    <div className="absolute inset-0 bg-[#141210]">
      {/* Ambient blurred cover */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`bg-${photo.id}-${index}`}
          src={photo.displayUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-[60px]"
          draggable={false}
        />
      </div>

      {/* Hero photo */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        <div className="relative flex max-h-[88vh] max-w-[92vw] items-center justify-center overflow-hidden rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${photo.id}-${index}-${kenBurns.from}`}
            src={photo.displayUrl}
            alt={photo.caption ?? "Guestbook photo"}
            className="max-h-[88vh] max-w-[92vw] object-contain will-change-transform"
            style={{
              ["--kb-from" as string]: kenBurns.from,
              ["--kb-to" as string]: kenBurns.to,
              transform: kenBurns.from,
              animation: `guestbookKenBurns ${SLIDE_MS}ms linear forwards`,
              animationPlayState: paused ? "paused" : "running",
            }}
            draggable={false}
          />
        </div>
      </div>

      {(photo.caption || dateLabel) && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-6 pb-8 pt-20 sm:px-10 sm:pb-10"
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        >
          {photo.caption && (
            <p className="max-w-2xl font-[family-name:var(--font-fraunces)] text-2xl font-medium text-[#F5EFE3] sm:text-3xl">
              {photo.caption}
            </p>
          )}
          {dateLabel && (
            <p className="mt-2 text-sm text-[#F5EFE3]/70">{dateLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
