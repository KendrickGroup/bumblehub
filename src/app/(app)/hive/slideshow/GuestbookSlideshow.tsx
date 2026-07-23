"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatSlideshowDate, shuffleInPlace } from "@/lib/hive/format";

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
};

type KenBurns = {
  from: string;
  to: string;
};

function nextKenBurns(): KenBurns {
  const variants: KenBurns[] = [
    {
      from: "scale(1) translate(0%, 0%)",
      to: "scale(1.08) translate(-1.5%, -1%)",
    },
    {
      from: "scale(1.06) translate(-2%, 1%)",
      to: "scale(1) translate(0.5%, 0%)",
    },
    {
      from: "scale(1) translate(1%, -1%)",
      to: "scale(1.07) translate(-1%, 1.5%)",
    },
    {
      from: "scale(1.05) translate(0%, 0%)",
      to: "scale(1) translate(-1.5%, -0.5%)",
    },
  ];
  return variants[Math.floor(Math.random() * variants.length)]!;
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

export function GuestbookSlideshow({ initialPhotos }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState(() => shuffleInPlace([...initialPhotos]));
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [kenBurns, setKenBurns] = useState<KenBurns>(() => nextKenBurns());
  const preloaded = useRef(new Set<string>());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const exit = useCallback(() => {
    router.push("/hive");
  }, [router]);

  const preload = useCallback((url: string) => {
    if (!url || preloaded.current.has(url)) return;
    const img = new window.Image();
    img.src = url;
    preloaded.current.add(url);
  }, []);

  useEffect(() => {
    if (queue.length === 0) {
      router.replace("/hive");
    }
  }, [queue.length, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit();
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
                router.replace("/hive");
                return;
              }
              setQueue(shuffleInPlace([...next]));
              setKenBurns(nextKenBurns());
              setIndex(0);
              setVisible(true);
              return;
            }
          } catch {
            // Keep cycling current queue.
          }
        }

        setKenBurns(nextKenBurns());
        setIndex((i) => (i + 1) % queueRef.current.length);
        setVisible(true);
      })();
    }, SLIDE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [index, queue, preload, router]);

  const photo = queue[index];
  if (!photo) return null;

  const dateLabel = formatSlideshowDate(photo.taken_at ?? photo.created_at);

  return (
    <div
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
            animation: `guestbookKenBurns ${SLIDE_MS}ms ease-in-out forwards`,
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
