"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BeeMark } from "@/components/brand/AppBrandLockup";
import {
  IDLE_RETURN_PATH_KEY,
  isSafeReturnPath,
} from "@/lib/idle/settings";
import { shuffleInPlace } from "@/lib/hive/format";
import type { SlideshowStyle } from "@/lib/hive/slideshow-style";
import type { SlideshowPhoto } from "./types";
import { GallerySlideshow } from "./styles/GallerySlideshow";
import { CorkboardSlideshow } from "./styles/CorkboardSlideshow";
import { FridgeDoorSlideshow } from "./styles/FridgeDoorSlideshow";
import { MemoriesSlideshow } from "./styles/MemoriesSlideshow";
import { ReflectionSlideshow } from "./styles/ReflectionSlideshow";

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
};

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

function isFullscreenActive(): boolean {
  const doc = document as DocWithWebkit;
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

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
    // Denied or unavailable — stay in full-viewport mode.
  }
}

export async function exitFullscreenIfNeeded(): Promise<void> {
  if (!isFullscreenActive()) return;
  const doc = document as DocWithWebkit;
  try {
    if (typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === "function") {
      await doc.webkitExitFullscreen();
      return;
    }
    if (typeof doc.webkitCancelFullScreen === "function") {
      await doc.webkitCancelFullScreen();
    }
  } catch {
    // Ignore exit failures.
  }
}

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <time className="font-medium tabular-nums tracking-wide text-[#F5EFE3]/85">
      {now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}
    </time>
  );
}

type Props = {
  initialPhotos: SlideshowPhoto[];
  driftMode?: boolean;
  style: SlideshowStyle;
};

export function GuestbookSlideshow({
  initialPhotos,
  driftMode = false,
  style,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState(() =>
    shuffleInPlace([...initialPhotos]),
  );
  const [tabVisible, setTabVisible] = useState(true);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const exitingRef = useRef(false);
  const preloaded = useRef(new Set<string>());

  const resolveExitPath = useCallback(() => {
    if (!driftMode) return "/hive";
    const stored = sessionStorage.getItem(IDLE_RETURN_PATH_KEY);
    sessionStorage.removeItem(IDLE_RETURN_PATH_KEY);
    if (stored && isSafeReturnPath(stored)) return stored;
    return "/home";
  }, [driftMode]);

  const exit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void (async () => {
      if (!driftMode) {
        await exitFullscreenIfNeeded();
      }
      router.push(resolveExitPath());
    })();
  }, [router, driftMode, resolveExitPath]);

  const preload = useCallback((url: string) => {
    if (!url || preloaded.current.has(url)) return;
    const img = new window.Image();
    img.src = url;
    preloaded.current.add(url);
  }, []);

  const leaveForEmpty = useCallback(async () => {
    if (!driftMode) {
      await exitFullscreenIfNeeded();
    }
    router.replace(driftMode ? resolveExitPath() : "/hive");
  }, [driftMode, resolveExitPath, router]);

  const refetchPhotos = useCallback(async (): Promise<SlideshowPhoto[]> => {
    try {
      const response = await fetch("/api/hive/guestbook", {
        cache: "no-store",
      });
      if (!response.ok) return photosRef.current;
      const body = (await response.json()) as { photos?: SlideshowPhoto[] };
      const next = body.photos ?? [];
      if (next.length === 0) {
        await leaveForEmpty();
        return [];
      }
      const shuffled = shuffleInPlace([...next]);
      setPhotos(shuffled);
      return shuffled;
    } catch {
      return photosRef.current;
    }
  }, [leaveForEmpty]);

  useEffect(() => {
    if (photos.length === 0) {
      void leaveForEmpty();
    }
  }, [photos.length, leaveForEmpty]);

  useEffect(() => {
    if (driftMode) return;
    const el = rootRef.current;
    if (el) void requestFullscreen(el);
    return () => {
      void exitFullscreenIfNeeded();
    };
  }, [driftMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      try {
        if (!("wakeLock" in navigator)) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        // Unsupported or denied.
      }
    }

    void requestWakeLock();

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setTabVisible(visible);
      if (visible) void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  if (photos.length === 0) return null;

  const styleProps = {
    photos,
    paused: !tabVisible,
    preload,
    refetchPhotos,
  };

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      onClick={exit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") exit();
      }}
      className="fixed inset-0 z-[100] cursor-pointer outline-none"
      aria-label="Exit slideshow"
    >
      <div className="absolute top-0 right-0 z-30 flex items-center gap-3 p-6 sm:p-8">
        <BeeMark size={28} className="opacity-25" />
        <Clock />
      </div>

      {style === "gallery" ? (
        <GallerySlideshow {...styleProps} />
      ) : style === "corkboard" ? (
        <CorkboardSlideshow {...styleProps} />
      ) : style === "fridge" ? (
        <FridgeDoorSlideshow {...styleProps} />
      ) : style === "memories" ? (
        <MemoriesSlideshow {...styleProps} />
      ) : (
        <ReflectionSlideshow {...styleProps} />
      )}
    </div>
  );
}
