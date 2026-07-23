"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatSlideshowDate, shuffleInPlace } from "@/lib/hive/format";
import {
  IDLE_RETURN_PATH_KEY,
  isSafeReturnPath,
} from "@/lib/idle/settings";

const SLIDE_MS = 8000;
const FADE_MS = 1000;

export type SlideshowPhoto = {
  id: string;
  displayUrl: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
};

type Props = {
  initialPhotos: SlideshowPhoto[];
  driftMode?: boolean;
};

type KenBurns = {
  from: string;
  to: string;
};

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
};

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
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
  // Keep pan within the overscan created by scale so letterbox edges stay hidden.
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

async function exitFullscreenIfNeeded(): Promise<void> {
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

export function GuestbookSlideshow({
  initialPhotos,
  driftMode = false,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [queue, setQueue] = useState(() => shuffleInPlace([...initialPhotos]));
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const zoomInRef = useRef(true);
  const [kenBurns, setKenBurns] = useState<KenBurns>(() =>
    buildKenBurns(true),
  );
  const preloaded = useRef(new Set<string>());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const exitingRef = useRef(false);

  const advanceKenBurns = useCallback(() => {
    const zoomIn = zoomInRef.current;
    zoomInRef.current = !zoomIn;
    return buildKenBurns(zoomIn);
  }, []);

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

  useEffect(() => {
    if (queue.length === 0) {
      router.replace(driftMode ? resolveExitPath() : "/hive");
    }
  }, [queue.length, router, driftMode, resolveExitPath]);

  useEffect(() => {
    if (driftMode) return;
    const el = rootRef.current;
    if (el) {
      void requestFullscreen(el);
    }

    return () => {
      void exitFullscreenIfNeeded();
    };
  }, [driftMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // If still in fullscreen, the browser may consume Escape first.
        // Always leave the slideshow on Escape.
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
        // Unsupported or denied — fail silently.
      }
    }

    void requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (queue.length === 0) return;

    const current = queue[index];
    const upcoming = queue[(index + 1) % queue.length];
    if (current) preload(current.displayUrl);
    if (upcoming) preload(upcoming.displayUrl);

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, SLIDE_MS - FADE_MS);

    const advanceTimer = window.setTimeout(() => {
      void (async () => {
        const atEnd = index >= queueRef.current.length - 1;
        if (atEnd) {
          try {
            const response = await fetch("/api/hive/guestbook", {
              cache: "no-store",
            });
            if (response.ok) {
              const body = (await response.json()) as {
                photos?: SlideshowPhoto[];
              };
              const next = body.photos ?? [];
              if (next.length === 0) {
                if (!driftMode) {
                  await exitFullscreenIfNeeded();
                }
                router.replace(driftMode ? resolveExitPath() : "/hive");
                return;
              }
              setQueue(shuffleInPlace([...next]));
              setKenBurns(advanceKenBurns());
              setIndex(0);
              setVisible(true);
              return;
            }
          } catch {
            // Keep cycling current queue.
          }
        }

        setKenBurns(advanceKenBurns());
        setIndex((i) => (i + 1) % queueRef.current.length);
        setVisible(true);
      })();
    }, SLIDE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [index, queue, preload, router, advanceKenBurns, driftMode, resolveExitPath]);

  const photo = queue[index];
  if (!photo) return null;

  const dateLabel = formatSlideshowDate(photo.taken_at ?? photo.created_at);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      onClick={exit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") exit();
      }}
      className="fixed inset-0 z-[100] cursor-pointer bg-[#141210] outline-none"
      aria-label="Exit slideshow"
    >
      <div className="absolute top-0 right-0 z-20 p-6 sm:p-8">
        <Clock />
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden px-4 py-10 sm:px-10"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${photo.id}-${index}-${kenBurns.from}`}
          src={photo.displayUrl}
          alt={photo.caption ?? "Guestbook photo"}
          className="max-h-full max-w-full object-contain will-change-transform"
          style={{
            ["--kb-from" as string]: kenBurns.from,
            ["--kb-to" as string]: kenBurns.to,
            transform: kenBurns.from,
            animation: `guestbookKenBurns ${SLIDE_MS}ms linear forwards`,
          }}
          draggable={false}
        />
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
