"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isIdleBlockedByGates, subscribeIdleGates } from "@/lib/idle/gates";
import {
  DEFAULT_IDLE_DRIFT_SETTINGS,
  IDLE_DRIFT_SETTINGS_EVENT,
  IDLE_RETURN_PATH_KEY,
  readCachedIdleDriftSettings,
  cacheIdleDriftSettings,
  type IdleDriftSettings,
} from "@/lib/idle/settings";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
] as const;

const POINTER_MOVE_DEBOUNCE_MS = 800;

export function IdleDriftWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [settings, setSettings] = useState<IdleDriftSettings>(
    () => readCachedIdleDriftSettings() ?? DEFAULT_IDLE_DRIFT_SETTINGS,
  );
  const lastActivityRef = useRef(Date.now());
  const pathnameRef = useRef(pathname);
  const searchRef = useRef(searchParams.toString());
  const settingsRef = useRef(settings);
  const checkingPhotosRef = useRef(false);

  pathnameRef.current = pathname;
  searchRef.current = searchParams.toString();
  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/settings/idle-drift", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { settings?: IdleDriftSettings };
        if (body.settings) {
          setSettings(body.settings);
          cacheIdleDriftSettings(body.settings);
        }
      } catch {
        // Keep defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent<IdleDriftSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener(IDLE_DRIFT_SETTINGS_EVENT, onSettings);
    return () =>
      window.removeEventListener(IDLE_DRIFT_SETTINGS_EVENT, onSettings);
  }, []);

  useEffect(() => subscribeIdleGates(() => {
    // Gate changes reset activity so a finished timer doesn't instantly drift.
    if (!isIdleBlockedByGates()) {
      lastActivityRef.current = Date.now();
    }
  }), []);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    markActivity();
  }, [pathname, searchParams, markActivity]);

  useEffect(() => {
    let moveTimeout: ReturnType<typeof setTimeout> | null = null;

    const onActivity = (event: Event) => {
      if (event.type === "pointermove") {
        if (moveTimeout) return;
        moveTimeout = setTimeout(() => {
          moveTimeout = null;
          markActivity();
        }, POINTER_MOVE_DEBOUNCE_MS);
        return;
      }
      markActivity();
    };

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true, capture: true });
    }

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity, { capture: true });
      }
    };
  }, [markActivity]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = settingsRef.current;
      if (!current.enabled) return;
      if (document.visibilityState !== "visible") return;

      const path = pathnameRef.current;
      if (path.startsWith("/hive/slideshow")) return;
      if (path.startsWith("/guestbook")) return;
      if (isIdleBlockedByGates()) return;

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < current.minutes * 60_000) return;
      if (checkingPhotosRef.current) return;

      checkingPhotosRef.current = true;
      void (async () => {
        try {
          const response = await fetch("/api/hive/guestbook", {
            cache: "no-store",
          });
          if (!response.ok) return;
          const body = (await response.json()) as { photos?: unknown[] };
          if (!body.photos || body.photos.length === 0) {
            // Nothing to show — reset so we don't hammer the API every tick.
            lastActivityRef.current = Date.now();
            return;
          }

          const search = searchRef.current;
          const returnPath = search ? `${path}?${search}` : path;
          sessionStorage.setItem(IDLE_RETURN_PATH_KEY, returnPath);
          router.push("/hive/slideshow?drift=1");
        } catch {
          // Stay put on failure.
        } finally {
          checkingPhotosRef.current = false;
        }
      })();
    }, 5000);

    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
