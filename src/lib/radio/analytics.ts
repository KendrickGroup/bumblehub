/**
 * Shapes and rules shared by the loggers, the ingest routes, and the Settings
 * lists. Nothing here identifies a person: the only thing that follows a
 * listener around is session_key, a random per-tab string that exists so ten
 * tunes in one sitting read differently from ten people tuning once.
 */

/** Spinning through the presets must not inflate anything. */
export const PLAY_MIN_SECONDS = 10;
/** A radio left on all night would otherwise swamp every other number. */
export const PLAY_MAX_SECONDS = 4 * 60 * 60;

export const BANNER_EVENT_KINDS = ["impression", "expand", "buy"] as const;
export type BannerEventKind = (typeof BANNER_EVENT_KINDS)[number];

export const ANALYTICS_RANGES = ["7", "30", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const ANALYTICS_RANGE_DEFAULT: AnalyticsRange = "30";

export const BANNER_EVENT_BATCH_MAX = 40;
export const SESSION_KEY_MAX = 64;

export type PlayRecord = {
  station_call: string;
  station_id: string | null;
  band: string;
  started_at: string;
  seconds: number;
  session_key: string | null;
};

export type BannerEventRecord = {
  product_handle: string;
  product_title: string | null;
  kind: BannerEventKind;
  station_call: string | null;
};

export type StationTotal = {
  stationCall: string;
  stationId: string | null;
  band: string;
  frequency: string | null;
  stationName: string | null;
  plays: number;
  seconds: number;
};

export type ProductTotal = {
  handle: string;
  title: string;
  impressions: number;
  expands: number;
  buys: number;
  retired: boolean;
};

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange);
}

/** Start of the window a range covers. "all" reaches back past any row. */
export function rangeStart(range: AnalyticsRange, now = Date.now()): Date {
  if (range === "all") return new Date(0);
  const days = range === "7" ? 7 : 30;
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export function rangeLabel(range: AnalyticsRange): string {
  if (range === "7") return "7 days";
  if (range === "30") return "30 days";
  return "All time";
}

/** Hours and minutes, which is how a day of listening reads. */
export function formatListenTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.round((whole % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${whole}s`;
}

/** An average play is minutes, so seconds still matter here. */
export function formatAverage(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole >= 3600) return formatListenTime(whole);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes > 0) return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${whole}s`;
}

export function formatRate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  const pct = (numerator / denominator) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

/**
 * Sorted the way each list is meant to be read: stations by time listened, so a
 * station people tap and abandon cannot look popular, and products by expand
 * rate, so a shirt that rarely shows but always gets a look rises.
 */
export function byListenTime(a: StationTotal, b: StationTotal): number {
  return b.seconds - a.seconds || b.plays - a.plays;
}

export function byExpandRate(a: ProductTotal, b: ProductTotal): number {
  const rate = (row: ProductTotal) =>
    row.impressions > 0 ? row.expands / row.impressions : -1;
  return (
    rate(b) - rate(a) || b.expands - a.expands || b.impressions - a.impressions
  );
}
