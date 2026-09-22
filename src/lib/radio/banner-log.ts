"use client";

/**
 * Impressions, expands and buys for the shop banner.
 *
 * An impression is once per product per sitting, not once per crossfade: the
 * banner rotates every few seconds, so per-rotation logging would flood the
 * table and make the expand rate meaningless. Expands and buys count every
 * time — curiosity and intent are different signals.
 *
 * Writes are batched. A sitting that sees eight shirts sends one request.
 */

import {
  BANNER_EVENT_BATCH_MAX,
  type BannerEventKind,
  type BannerEventRecord,
} from "./analytics";
import { postAnalytics, sessionKey } from "./analytics-session";
import { currentStationCall } from "./play-log";

export const BANNER_EVENTS_ENDPOINT = "/api/radio/banner-events";

const SEEN_STORAGE = "bumblehub:banner-seen";
const IMPRESSION_FLUSH_MS = 4000;
/** Curiosity and intent are rare and worth sending promptly. */
const TAP_FLUSH_MS = 250;

let queue: BannerEventRecord[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let seen: Set<string> | null = null;
let leaveBound = false;

function loadSeen(): Set<string> {
  if (seen) return seen;
  seen = new Set();
  if (typeof window === "undefined") return seen;
  try {
    const raw = window.sessionStorage.getItem(SEEN_STORAGE);
    if (raw) for (const handle of JSON.parse(raw) as string[]) seen.add(handle);
  } catch {
    // A blocked store just means the dedupe lives in memory for this page.
  }
  return seen;
}

function rememberSeen(handle: string) {
  const set = loadSeen();
  set.add(handle);
  try {
    window.sessionStorage.setItem(SEEN_STORAGE, JSON.stringify([...set]));
  } catch {
    // Memory is enough.
  }
}

function flush(leaving = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  postAnalytics(
    BANNER_EVENTS_ENDPOINT,
    { events, session_key: sessionKey() },
    leaving,
  );
}

function bindLeave() {
  if (leaveBound || typeof window === "undefined") return;
  leaveBound = true;
  window.addEventListener("pagehide", () => flush(true));
}

function enqueue(
  kind: BannerEventKind,
  handle: string,
  title: string,
  waitMs: number,
) {
  bindLeave();
  queue.push({
    product_handle: handle,
    product_title: title || null,
    kind,
    station_call: currentStationCall(),
  });
  if (queue.length >= BANNER_EVENT_BATCH_MAX) {
    flush();
    return;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => flush(), waitMs);
}

/** Call only when the product was really on screen and not behind anything. */
export function noteImpression(handle: string, title: string) {
  const key = handle.trim();
  if (!key || loadSeen().has(key)) return;
  rememberSeen(key);
  enqueue("impression", key, title, IMPRESSION_FLUSH_MS);
}

export function noteExpand(handle: string, title: string) {
  const key = handle.trim();
  if (!key) return;
  enqueue("expand", key, title, TAP_FLUSH_MS);
}

export function noteBuy(handle: string, title: string) {
  const key = handle.trim();
  if (!key) return;
  enqueue("buy", key, title, TAP_FLUSH_MS);
  // The shop opens in a new tab, but send now rather than trust the timer.
  flush(true);
}
