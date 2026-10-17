"use client";

/**
 * When to offer the 15% code.
 *
 * The clock runs only while audio is actually playing, and it carries across
 * visits. At five minutes the modal shows once. Dismissing it, or opening it
 * from the banner, is enough — it does not ask again on its own.
 */

import { useSyncExternalStore } from "react";

export const OFFER_ASK_SECONDS = 300;
const STORAGE_KEY = "latigo_radio_offer";
const TICK_MS = 5000;

type OfferState = {
  listenedSeconds: number;
  seen: boolean;
};

let state: OfferState | null = null;
let due = false;
let playingSince: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let leaveBound = false;
const listeners = new Set<() => void>();

function fresh(): OfferState {
  return { listenedSeconds: 0, seen: false };
}

function load(): OfferState {
  if (state) return state;
  state = fresh();
  if (typeof window === "undefined") return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<OfferState>;
      const listened = Number(saved.listenedSeconds);
      state = {
        listenedSeconds:
          Number.isFinite(listened) && listened > 0 ? Math.floor(listened) : 0,
        seen: saved.seen === true,
      };
    }
  } catch {
    // Private mode or a bad value: keep the in-memory clock.
  }
  return state;
}

function save() {
  if (!state || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The clock still runs for this visit.
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function accrue() {
  if (playingSince === null) return;
  const gate = load();
  const seconds = Math.floor((Date.now() - playingSince) / 1000);
  if (seconds <= 0) return;
  gate.listenedSeconds += seconds;
  playingSince += seconds * 1000;
}

function checkDue() {
  const gate = load();
  const next = !gate.seen && gate.listenedSeconds >= OFFER_ASK_SECONDS;
  if (next === due) return;
  due = next;
  notify();
}

function stopTimer() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    accrue();
    save();
    checkDue();
  }, TICK_MS);
}

function bindLeave() {
  if (leaveBound || typeof window === "undefined") return;
  leaveBound = true;
  window.addEventListener("pagehide", () => {
    accrue();
    save();
  });
}

/** Called from the player's status funnel. Playing means sound, not a quiet page. */
export function noteOfferListening(playing: boolean): void {
  bindLeave();
  load();
  if (playing) {
    if (playingSince === null) playingSince = Date.now();
    startTimer();
    return;
  }
  accrue();
  playingSince = null;
  stopTimer();
  save();
  checkDue();
}

function rememberSeen(announce: boolean) {
  const gate = load();
  gate.seen = true;
  save();
  due = false;
  if (announce) notify();
}

/** The offer has been shown. The timer will not raise it again. */
export function markOfferSeen(): void {
  rememberSeen(true);
}

/**
 * Same as markOfferSeen, without telling React. Used while a render is
 * already opening the card, so the store does not schedule a second update.
 */
export function markOfferSeenQuiet(): void {
  rememberSeen(false);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOfferDue(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => due,
    () => false,
  );
}
