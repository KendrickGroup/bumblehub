"use client";

/**
 * Counts what was actually listened to.
 *
 * The clock only runs while the player says "playing", so buffering and
 * reconnects don't pad a tune, and a row is only sent once it crosses ten
 * seconds — spinning the presets leaves nothing behind. One row covers one
 * sitting on one station: switching, stopping, or leaving closes it.
 */

import {
  PLAY_MAX_SECONDS,
  PLAY_MIN_SECONDS,
  type PlayRecord,
} from "./analytics";
import { postAnalytics, sessionKey } from "./analytics-session";
import { playLogBand } from "./ranch";
import { WX_STATION_ID } from "./wx-stream";

export const PLAYS_ENDPOINT = "/api/radio/plays";

const CAP_TICK_MS = 30_000;

type StationLike = {
  id: string;
  station_name?: string | null;
  call_sign?: string | null;
  band?: string | null;
};

type PlayerLike = {
  status: string;
  stationId: string | null;
  stationName: string | null;
};

type StationMeta = { id: string; call: string; band: string };

type OpenPlay = {
  meta: StationMeta;
  startedAt: string;
  accruedMs: number;
  /** Wall clock when the current playing stretch began; null while held. */
  playingSince: number | null;
};

let open: OpenPlay | null = null;
let capTimer: ReturnType<typeof setInterval> | null = null;
let leaveBound = false;

function metaFor(player: PlayerLike, station: StationLike | null): StationMeta | null {
  const id = station?.id ?? player.stationId;
  if (!id) return null;
  const call =
    (station?.call_sign ?? "").trim() ||
    (station?.station_name ?? player.stationName ?? "").trim();
  if (!call) return null;
  const band = playLogBand(station?.band, id === WX_STATION_ID);
  return { id, call: call.slice(0, 80), band };
}

function elapsedMs(play: OpenPlay): number {
  const live = play.playingSince ? Date.now() - play.playingSince : 0;
  return play.accruedMs + Math.max(0, live);
}

function holdClock() {
  if (!open?.playingSince) return;
  open.accruedMs = elapsedMs(open);
  open.playingSince = null;
}

function stopCapTimer() {
  if (!capTimer) return;
  clearInterval(capTimer);
  capTimer = null;
}

function startCapTimer() {
  if (capTimer) return;
  capTimer = setInterval(() => {
    if (!open) {
      stopCapTimer();
      return;
    }
    if (elapsedMs(open) >= PLAY_MAX_SECONDS * 1000) {
      // An all-night listen becomes consecutive capped rows, not one huge one.
      const meta = open.meta;
      const wasPlaying = open.playingSince !== null;
      send(open, false);
      open = null;
      if (wasPlaying) beginPlay(meta);
    }
  }, CAP_TICK_MS);
}

function send(play: OpenPlay, leaving: boolean) {
  const seconds = Math.min(
    PLAY_MAX_SECONDS,
    Math.floor(elapsedMs(play) / 1000),
  );
  if (seconds < PLAY_MIN_SECONDS) return;
  const record: PlayRecord = {
    station_call: play.meta.call,
    station_id: play.meta.id,
    band: play.meta.band,
    started_at: play.startedAt,
    seconds,
    session_key: sessionKey(),
  };
  postAnalytics(PLAYS_ENDPOINT, record, leaving);
}

function beginPlay(meta: StationMeta) {
  open = {
    meta,
    startedAt: new Date().toISOString(),
    accruedMs: 0,
    playingSince: Date.now(),
  };
  startCapTimer();
}

function closePlay(leaving = false) {
  if (!open) return;
  holdClock();
  send(open, leaving);
  open = null;
  stopCapTimer();
}

function bindLeave() {
  if (leaveBound || typeof window === "undefined") return;
  leaveBound = true;
  // pagehide, not visibilitychange: a locked phone keeps the stream running, so
  // hiding the tab is not the end of a tune. A restored page reopens the clock.
  window.addEventListener("pagehide", () => {
    if (!open) return;
    const meta = open.meta;
    const wasPlaying = open.playingSince !== null;
    closePlay(true);
    if (wasPlaying) beginPlay(meta);
  });
}

/** The player's one funnel for state changes calls this on every transition. */
export function trackPlayerStatus(
  player: PlayerLike,
  station: StationLike | null,
): void {
  bindLeave();
  const meta = metaFor(player, station);

  if (open && (!meta || meta.id !== open.meta.id)) closePlay();

  if (player.status === "playing") {
    if (!meta) return;
    if (!open) {
      beginPlay(meta);
      return;
    }
    if (open.playingSince === null) {
      open.playingSince = Date.now();
      startCapTimer();
    }
    return;
  }

  if (player.status === "buffering") {
    // Same tune, dead air: hold the clock but keep the row open.
    holdClock();
    return;
  }

  closePlay();
}

/** Whatever is on the dial right now, for tagging banner events. */
export function currentStationCall(): string | null {
  return open?.meta.call ?? null;
}
