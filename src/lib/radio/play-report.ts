import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export type StationPlayCount = {
  station: string;
  plays: number;
};

export type PlayReport = {
  available: boolean;
  total: number;
  lastDay: number;
  lastWeek: number;
  listeners: number;
  top: StationPlayCount[];
};

const EMPTY: PlayReport = {
  available: false,
  total: 0,
  lastDay: 0,
  lastWeek: 0,
  listeners: 0,
  top: [],
};

function asCount(raw: number | string | null | undefined): number {
  const n = typeof raw === "string" ? Number(raw) : raw ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

export async function fetchPlayReport(): Promise<PlayReport> {
  try {
    const db = createServiceClient();
    const [summaryRes, topRes] = await Promise.all([
      db.rpc("radio_play_summary"),
      db.rpc("radio_play_top_stations", { lim: 8 }),
    ]);
    if (summaryRes.error || topRes.error) return EMPTY;
    const summary = Array.isArray(summaryRes.data) ? summaryRes.data[0] : null;
    const top = ((topRes.data ?? []) as { station?: string | null; plays?: number | string | null }[])
      .flatMap((row) => {
        const station = row.station?.trim();
        if (!station) return [];
        return [{ station, plays: asCount(row.plays) }];
      });
    return {
      available: true,
      total: asCount(summary?.total),
      lastDay: asCount(summary?.last_day),
      lastWeek: asCount(summary?.last_week),
      listeners: asCount(summary?.listeners),
      top,
    };
  } catch {
    return EMPTY;
  }
}
