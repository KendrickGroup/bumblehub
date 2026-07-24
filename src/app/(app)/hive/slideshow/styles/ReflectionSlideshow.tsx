"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatSlideshowDate } from "@/lib/hive/format";
import type { StyleSlideshowProps } from "../types";

const SLIDE_MS = 8000;
const FADE_MS = 1500;

export function ReflectionSlideshow({
  photos,
  paused,
  preload,
  refetchPhotos,
}: StyleSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [breatheKey, setBreatheKey] = useState(0);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const indexRef = useRef(index);
  indexRef.current = index;

  const advance = useCallback(async () => {
    const atEnd = indexRef.current >= photosRef.current.length - 1;
    if (atEnd) {
      const next = await refetchPhotos();
      if (next.length === 0) return;
      setIndex(0);
      setBreatheKey((k) => k + 1);
      setVisible(true);
      return;
    }
    setIndex((i) => (i + 1) % photosRef.current.length);
    setBreatheKey((k) => k + 1);
    setVisible(true);
  }, [refetchPhotos]);

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
      void advance();
    }, SLIDE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [index, photos, paused, preload, advance]);

  useEffect(() => {
    if (index >= photos.length) setIndex(0);
  }, [photos.length, index]);

  const photo = photos[index];
  if (!photo) return null;

  const dateLabel = formatSlideshowDate(photo.taken_at ?? photo.created_at);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141210]">
      <div
        className="absolute inset-0 flex flex-col items-center justify-start pt-[8vh] sm:pt-[10vh]"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        <div
          key={`photo-${photo.id}-${breatheKey}`}
          className="relative flex w-[min(88vw,720px)] flex-col items-center"
          style={{
            animation: paused
              ? undefined
              : `reflectionBreathe ${SLIDE_MS}ms ease-in-out forwards`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.displayUrl}
            alt={photo.caption ?? "Guestbook photo"}
            className="h-[55vh] w-auto max-w-full rounded-sm object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            draggable={false}
          />

          {/* Glass-shelf reflection */}
          <div
            className="relative w-full overflow-hidden"
            style={{ height: "calc(55vh * 0.3)" }}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.displayUrl}
              alt=""
              className="h-[55vh] w-auto max-w-full object-contain opacity-35 blur-[2px]"
              style={{
                transform: "rotateX(180deg)",
                transformOrigin: "top center",
                WebkitMaskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
              }}
              draggable={false}
            />
          </div>
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
