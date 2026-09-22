"use client";

/**
 * The per-sitting key, and the one-line send both loggers use.
 *
 * sessionStorage, not localStorage: the key should die with the tab so a
 * different sitting counts as a different listener, while a reload in the same
 * tab stays one sitting — which is what makes "one impression per product per
 * session" mean anything.
 */

import { SESSION_KEY_MAX } from "./analytics";

const SESSION_KEY_STORAGE = "bumblehub:radio-session";

let memoryKey: string | null = null;
let surface: "public" | "app" = "app";

/**
 * Which radio the listener is on. The server also reads the hostname, but only
 * the page knows it is the public radio when that page is served from
 * bumblehub.dev rather than radio.latigocowboy.com.
 */
export function setAnalyticsSurface(next: "public" | "app") {
  surface = next;
}

function randomKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function sessionKey(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryKey) return memoryKey;
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (stored) {
      memoryKey = stored.slice(0, SESSION_KEY_MAX);
      return memoryKey;
    }
    const next = randomKey();
    window.sessionStorage.setItem(SESSION_KEY_STORAGE, next);
    memoryKey = next;
    return next;
  } catch {
    // Private mode or blocked storage: still count the plays, just unkeyed.
    memoryKey = memoryKey ?? randomKey();
    return memoryKey;
  }
}

/**
 * Fire and forget. sendBeacon when the page may be going away, since a normal
 * fetch is cancelled with the document; keepalive covers the rest.
 */
export function postAnalytics(
  path: string,
  body: Record<string, unknown>,
  leaving = false,
): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify({ ...body, surface });
  if (leaving && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(path, blob)) return;
    } catch {
      // Fall through to fetch.
    }
  }
  try {
    void fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
      cache: "no-store",
    }).catch(() => {});
  } catch {
    // Analytics never break the radio.
  }
}
