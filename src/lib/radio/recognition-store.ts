import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import {
  AUDD_COOLDOWN_SECONDS,
  STATION_FRESH_MS,
  auddMonthlyLimit,
  recognitionMonth,
  type ResolvedSong,
} from "./recognition";

export type StationNowPlaying = {
  song: ResolvedSong | null;
  rawMetadata: string | null;
  resolvedAt: number;
  lastAuddAt: number | null;
};

export type AuddUsage = {
  month: string;
  calls: number;
  limit: number;
  stations: { stationCall: string; calls: number }[];
};

function service() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

export async function findRecognizedSong(
  key: string,
): Promise<ResolvedSong | null> {
  if (!key) return null;
  const db = service();
  if (!db) return null;
  const { data } = await db
    .from("recognized_songs")
    .select("title, artist, album, artwork_url")
    .eq("normalized_key", key)
    .maybeSingle();
  if (!data?.title || !data.artist) return null;
  return {
    title: data.title,
    artist: data.artist,
    album: data.album ?? null,
    artworkUrl: data.artwork_url ?? null,
  };
}

export async function saveRecognizedSong(
  key: string,
  song: ResolvedSong,
  source: "audd" | "metadata",
): Promise<string | null> {
  if (!key) return null;
  const db = service();
  if (!db) return null;
  const { data } = await db
    .from("recognized_songs")
    .upsert(
      {
        normalized_key: key,
        title: song.title,
        artist: song.artist,
        album: song.album,
        artwork_url: song.artworkUrl,
        source,
      },
      { onConflict: "normalized_key" },
    )
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export async function readStationNowPlaying(
  stationCall: string,
): Promise<StationNowPlaying | null> {
  const db = service();
  if (!db) return null;
  const { data } = await db
    .from("station_now_playing")
    .select(
      "raw_metadata, resolved_at, last_audd_at, recognized_songs ( title, artist, album, artwork_url )",
    )
    .eq("station_call", stationCall)
    .maybeSingle();
  if (!data) return null;
  const joined = data.recognized_songs as
    | { title: string; artist: string; album: string | null; artwork_url: string | null }
    | { title: string; artist: string; album: string | null; artwork_url: string | null }[]
    | null;
  const row = Array.isArray(joined) ? joined[0] : joined;
  const resolvedAt = Date.parse(data.resolved_at);
  const lastAuddAt = data.last_audd_at ? Date.parse(data.last_audd_at) : null;
  return {
    song:
      row?.title && row.artist
        ? {
            title: row.title,
            artist: row.artist,
            album: row.album ?? null,
            artworkUrl: row.artwork_url ?? null,
          }
        : null,
    rawMetadata: data.raw_metadata ?? null,
    resolvedAt: Number.isFinite(resolvedAt) ? resolvedAt : 0,
    lastAuddAt: lastAuddAt && Number.isFinite(lastAuddAt) ? lastAuddAt : null,
  };
}

export function stationIsFresh(row: StationNowPlaying | null, now = Date.now()): boolean {
  if (!row?.song) return false;
  return now - row.resolvedAt < STATION_FRESH_MS;
}

export function cooldownElapsed(row: StationNowPlaying | null, now = Date.now()): boolean {
  if (!row?.lastAuddAt) return true;
  return now - row.lastAuddAt >= AUDD_COOLDOWN_SECONDS * 1000;
}

export async function writeStationNowPlaying(
  stationCall: string,
  songId: string | null,
  rawMetadata: string | null,
): Promise<void> {
  const db = service();
  if (!db) return;
  await db.from("station_now_playing").upsert(
    {
      station_call: stationCall,
      recognized_song_id: songId,
      raw_metadata: rawMetadata,
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "station_call" },
  );
}

/** True if this instance won the right to spend on this station. */
export async function tryLockStation(stationCall: string): Promise<boolean> {
  const db = service();
  if (!db) return false;
  const { data, error } = await db.rpc("audd_try_lock_station", {
    p_call: stationCall,
    p_cooldown_seconds: AUDD_COOLDOWN_SECONDS,
  });
  if (error) {
    console.warn("[recognition] lock failed", error.message);
    return false;
  }
  return data === true;
}

/**
 * Reserve one paid call. -1 means the month is spent; null means the counter
 * itself is unreachable and we refuse to call (fail closed).
 */
export async function reserveAuddCall(stationCall: string): Promise<number | null> {
  const db = service();
  if (!db) return null;
  const { data, error } = await db.rpc("audd_reserve_call", {
    p_month: recognitionMonth(),
    p_limit: auddMonthlyLimit(),
    p_station: stationCall,
  });
  if (error) {
    console.warn("[recognition] reserve failed", error.message);
    return null;
  }
  const n = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function monthUnderLimit(): Promise<boolean> {
  const db = service();
  if (!db) return false;
  const { data } = await db
    .from("audd_usage")
    .select("calls")
    .eq("month", recognitionMonth())
    .maybeSingle();
  const calls = data?.calls ?? 0;
  return calls < auddMonthlyLimit();
}

export async function fetchAuddUsage(): Promise<AuddUsage> {
  const month = recognitionMonth();
  const limit = auddMonthlyLimit();
  const empty: AuddUsage = { month, calls: 0, limit, stations: [] };
  const db = service();
  if (!db) return empty;

  const [{ data: usage }, { data: stations }] = await Promise.all([
    db.from("audd_usage").select("calls").eq("month", month).maybeSingle(),
    db
      .from("audd_station_calls")
      .select("station_call, calls")
      .eq("month", month)
      .order("calls", { ascending: false })
      .limit(8),
  ]);

  return {
    month,
    calls: usage?.calls ?? 0,
    limit,
    stations: (stations ?? []).map((row) => ({
      stationCall: row.station_call,
      calls: row.calls,
    })),
  };
}
