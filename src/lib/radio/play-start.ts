"use client";

/**
 * One row when a station actually starts.
 *
 * Buffering and a reconnect on the same station do not count. A second tap
 * on that same station inside a few seconds does not count either. Switching
 * to a different station does.
 */

const VISITOR_KEY = "latigo_visitor";
const DEBOUNCE_MS = 3000;
export const PLAY_START_ENDPOINT = "/api/radio/play-starts";

type StationLike = {
  id?: string | null;
  dial_label?: string | null;
  call_sign?: string | null;
  station_name?: string | null;
} | null;

let settled: "playing" | "stopped" = "stopped";
let playingStationId: string | null = null;
let lastLoggedId: string | null = null;
let lastLoggedAt = 0;
let memoryVisitor: string | null = null;

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `v${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function visitorId(): string {
  if (typeof window === "undefined") return memoryVisitor ?? randomId();
  if (memoryVisitor) return memoryVisitor;
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY)?.trim() ?? "";
    if (/^[A-Za-z0-9-]{8,80}$/.test(stored) && !stored.includes("@")) {
      memoryVisitor = stored;
      return stored;
    }
    const next = randomId();
    window.localStorage.setItem(VISITOR_KEY, next);
    memoryVisitor = next;
    return next;
  } catch {
    memoryVisitor = memoryVisitor ?? randomId();
    return memoryVisitor;
  }
}

export function playStationLabel(station: StationLike): string {
  const dial = station?.dial_label?.trim();
  if (dial) return dial.slice(0, 80);
  const call = station?.call_sign?.trim();
  if (call) return call.slice(0, 80);
  const name = station?.station_name?.trim();
  return name ? name.slice(0, 80) : "";
}

function postStart(station: string) {
  const id = visitorId();
  try {
    void fetch(PLAY_START_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station, visitor_id: id }),
      keepalive: true,
    });
  } catch {
    // A missed count must not stop the radio.
  }
}

/** Called from the player's one status funnel. */
export function notePlayStart(
  status: string,
  stationId: string | null,
  label: string,
): void {
  if (status === "buffering") return;
  if (status !== "playing") {
    if (status === "stopped" || status === "failed") settled = "stopped";
    return;
  }

  const fromStopped = settled !== "playing";
  const switched = Boolean(stationId) && stationId !== playingStationId;
  settled = "playing";
  playingStationId = stationId;
  if (!fromStopped && !switched) return;
  if (!stationId || !label) return;

  const now = Date.now();
  if (stationId === lastLoggedId && now - lastLoggedAt < DEBOUNCE_MS) return;
  lastLoggedAt = now;
  lastLoggedId = stationId;
  postStart(label);
}
