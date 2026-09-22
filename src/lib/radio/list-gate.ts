"use client";

/**
 * When to ask someone to join the Latigo List.
 *
 * Paced by listening, not by visits: the clock only runs while audio is
 * actually playing, and it carries across sessions. First ask at twenty
 * minutes, then another half hour of listening after every "not right now".
 * Signing up is the only thing that stops it for good, and the server cookie
 * is what makes that survive a cleared localStorage.
 *
 * No email address is ever kept here.
 */

import { useSyncExternalStore } from "react";
import {
  LATIGO_ASK_AGAIN_SECONDS,
  LATIGO_FIRST_ASK_SECONDS,
  LATIGO_LIST_COOKIE,
  LATIGO_LIST_ENABLED,
  LATIGO_LIST_STORAGE_KEY,
} from "./latigo-list";

type ListStatus = "new" | "subscribed";

type GateState = {
  status: ListStatus;
  listenedSeconds: number;
  nextAskAt: number;
};

const TICK_MS = 5000;

let state: GateState | null = null;
let due = false;
let playingSince: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let leaveBound = false;
const listeners = new Set<() => void>();

function fresh(): GateState {
  return {
    status: "new",
    listenedSeconds: 0,
    nextAskAt: LATIGO_FIRST_ASK_SECONDS,
  };
}

function wholeSeconds(raw: unknown, fallback: number): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function load(): GateState {
  if (state) return state;
  state = fresh();
  if (typeof window === "undefined") return state;
  try {
    const raw = window.localStorage.getItem(LATIGO_LIST_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GateState>;
      const listenedSeconds = wholeSeconds(saved.listenedSeconds, 0);
      state = {
        status: saved.status === "subscribed" ? "subscribed" : "new",
        listenedSeconds,
        nextAskAt: wholeSeconds(saved.nextAskAt, LATIGO_FIRST_ASK_SECONDS),
      };
    }
  } catch {
    // Private mode or a mangled value: start the clock over in memory.
  }
  return state;
}

function save() {
  if (!state || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LATIGO_LIST_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Nothing to do — the clock still runs for this session.
  }
}

function hasCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${LATIGO_LIST_COOKIE}=1`);
}

/** Signed up, here or on another browser that left the cookie behind. */
function settled(): boolean {
  return load().status === "subscribed" || hasCookie();
}

function notify() {
  for (const listener of listeners) listener();
}

function accrue() {
  if (playingSince === null) return;
  const gate = load();
  const seconds = Math.floor((Date.now() - playingSince) / 1000);
  if (seconds > 0) {
    gate.listenedSeconds += seconds;
    playingSince += seconds * 1000;
  }
}

/** One ask per crossing: due stays up until it is dismissed or answered. */
function checkDue() {
  const gate = load();
  const next = !settled() && gate.listenedSeconds >= gate.nextAskAt;
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
  // A locked phone keeps playing, so this banks the time rather than ending it.
  window.addEventListener("pagehide", () => {
    accrue();
    save();
  });
}

/** Called from the player's one status funnel. */
export function noteListening(playing: boolean): void {
  if (!LATIGO_LIST_ENABLED) return;
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

/** Not right now: come back after another half hour of listening. */
export function dismissListAsk(): void {
  accrue();
  const gate = load();
  gate.nextAskAt = gate.listenedSeconds + LATIGO_ASK_AGAIN_SECONDS;
  save();
  due = false;
  notify();
}

/** They joined. Never ask again. */
export function markListJoined(): void {
  accrue();
  const gate = load();
  gate.status = "subscribed";
  save();
  due = false;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): boolean {
  return due;
}

function serverSnapshot(): boolean {
  return false;
}

export function useListAskDue(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
