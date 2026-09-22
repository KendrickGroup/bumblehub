import "server-only";

/**
 * Reads for the Settings lists. The tables have RLS on with no policies, so
 * these go through the service key — the same key that writes them — and the
 * grouping happens in Postgres rather than by pulling rows into Node.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  byExpandRate,
  byListenTime,
  rangeStart,
  type AnalyticsRange,
  type ProductTotal,
  type StationTotal,
} from "./analytics";

type StationRow = {
  station_call: string | null;
  station_id: string | null;
  band: string | null;
  frequency: string | null;
  station_name: string | null;
  plays: number | string | null;
  seconds: number | string | null;
};

type ProductRow = {
  product_handle: string | null;
  product_title: string | null;
  impressions: number | string | null;
  expands: number | string | null;
  buys: number | string | null;
};

/** Postgres returns bigint as a string over the wire. */
function count(raw: number | string | null): number {
  const n = typeof raw === "string" ? Number(raw) : raw ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

export async function stationTotals(
  range: AnalyticsRange,
  includeOwner: boolean,
): Promise<StationTotal[]> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("station_play_totals", {
    since: rangeStart(range).toISOString(),
    include_owner: includeOwner,
  });
  if (error) throw new Error(error.message);
  return ((data as StationRow[] | null) ?? [])
    .map((row) => ({
      stationCall: (row.station_call ?? "").trim() || "Unknown",
      stationId: row.station_id ?? null,
      band: (row.band ?? "fm").trim(),
      frequency: row.frequency?.trim() || null,
      stationName: row.station_name?.trim() || null,
      plays: count(row.plays),
      seconds: count(row.seconds),
    }))
    .sort(byListenTime);
}

/**
 * A product Dave has since dropped keeps its history and is marked retired —
 * deleting the rows would quietly rewrite what the banner has done.
 */
export async function productTotals(
  range: AnalyticsRange,
  includeOwner: boolean,
  liveHandles: Set<string>,
): Promise<ProductTotal[]> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("banner_product_totals", {
    since: rangeStart(range).toISOString(),
    include_owner: includeOwner,
  });
  if (error) throw new Error(error.message);
  return ((data as ProductRow[] | null) ?? [])
    .flatMap((row) => {
      const handle = (row.product_handle ?? "").trim();
      if (!handle) return [];
      return [
        {
          handle,
          title: row.product_title?.trim() || handle,
          impressions: count(row.impressions),
          expands: count(row.expands),
          buys: count(row.buys),
          retired: !liveHandles.has(handle),
        },
      ];
    })
    .sort(byExpandRate);
}
