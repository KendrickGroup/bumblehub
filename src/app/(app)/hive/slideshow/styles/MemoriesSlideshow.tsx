"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { guestbookTakenDateLabel } from "@/lib/hive/photo-labels";
import type { StyleSlideshowProps } from "../types";

const SLIDE_MS = 8000;
const TRANSITION_MS = 800;

export function MemoriesSlideshow({
  photos,
  paused,
  preload,
  refetchPhotos,
}: StyleSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [sliding, setSliding] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const indexRef = useRef(index);
  indexRef.current = index;

  const len = photos.length;

  const prevIndex = len > 0 ? (index - 1 + len) % len : 0;
  const nextIndex = len > 0 ? (index + 1) % len : 0;

  const advance = useCallback(async () => {
    const atEnd = indexRef.current >= photosRef.current.length - 1;
    if (atEnd) {
      const next = await refetchPhotos();
      if (next.length === 0) return;
      setIndex(0);
      return;
    }
    setIndex((i) => (i + 1) % photosRef.current.length);
  }, [refetchPhotos]);

  useEffect(() => {
    if (paused || photos.length === 0) return;

    const current = photos[index];
    const upcoming = photos[(index + 1) % photos.length];
    const previous = photos[(index - 1 + photos.length) % photos.length];
    if (current) preload(current.displayUrl);
    if (upcoming) preload(upcoming.displayUrl);
    if (previous) preload(previous.displayUrl);

    const startSlide = window.setTimeout(() => {
      setSliding(true);
    }, SLIDE_MS - TRANSITION_MS);

    const commit = window.setTimeout(() => {
      void (async () => {
        await advance();
        setSliding(false);
      })();
    }, SLIDE_MS);

    return () => {
      window.clearTimeout(startSlide);
      window.clearTimeout(commit);
    };
  }, [index, photos, paused, preload, advance]);

  useEffect(() => {
    if (index >= photos.length) setIndex(0);
  }, [photos.length, index]);

  if (photos.length === 0) return null;

  const center = photos[index]!;
  const left = photos[prevIndex]!;
  const right = photos[nextIndex]!;
  const dateLabel = guestbookTakenDateLabel(center.taken_at, "slideshow");

  // During slide: center moves left+blurs, right moves to center+sharpens
  const leftStyle = sliding
    ? {
        transform: "translateX(-120%) scale(0.45)",
        filter: "blur(28px)",
        opacity: 0,
      }
    : {
        transform: "translateX(-58%) scale(0.55)",
        filter: "blur(20px)",
        opacity: 0.65,
      };

  const centerStyle = sliding
    ? {
        transform: "translateX(-58%) scale(0.55)",
        filter: "blur(20px)",
        opacity: 0.65,
        zIndex: 5,
      }
    : {
        transform: "translateX(0) scale(1)",
        filter: "blur(0px)",
        opacity: 1,
        zIndex: 10,
      };

  const rightStyle = sliding
    ? {
        transform: "translateX(0) scale(1)",
        filter: "blur(0px)",
        opacity: 1,
        zIndex: 10,
      }
    : {
        transform: "translateX(58%) scale(0.55)",
        filter: "blur(20px)",
        opacity: 0.65,
        zIndex: 5,
      };

  const transition = `transform ${TRANSITION_MS}ms ease, filter ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141210]">
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Left peek */}
        <div
          className="absolute flex h-[70vh] w-[70vw] max-w-5xl items-center justify-center"
          style={{ ...leftStyle, transition }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={left.displayUrl}
            alt=""
            aria-hidden
            className="max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            draggable={false}
          />
        </div>

        {/* Center */}
        <div
          className="absolute flex h-[70vh] w-[70vw] max-w-5xl items-center justify-center"
          style={{ ...centerStyle, transition }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={center.displayUrl}
            alt={center.caption ?? "Photo Booth memory"}
            className="max-h-full max-w-full rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            draggable={false}
          />
        </div>

        {/* Right peek */}
        <div
          className="absolute flex h-[70vh] w-[70vw] max-w-5xl items-center justify-center"
          style={{ ...rightStyle, transition }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={right.displayUrl}
            alt=""
            aria-hidden
            className="max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            draggable={false}
          />
        </div>
      </div>

      {(center.caption || dateLabel) && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-10 text-center sm:px-10"
          style={{
            opacity: sliding ? 0 : 1,
            transition: `opacity ${TRANSITION_MS}ms ease`,
          }}
        >
          {center.caption ? (
            <>
              <p className="mx-auto max-w-xl font-[family-name:var(--font-fraunces)] text-2xl font-medium text-[#F5EFE3] sm:text-3xl">
                {center.caption}
              </p>
              {dateLabel ? (
                <p className="mt-2 text-sm text-[#F5EFE3]/70">{dateLabel}</p>
              ) : null}
            </>
          ) : (
            <p className="mx-auto max-w-xl text-base text-[#F5EFE3]/80 sm:text-lg">
              {dateLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
