/**
 * When a paid AudD call is allowed.
 *
 * The caches sit in front of the call. Ten people on KFWR share one answer.
 * Country radio repeats itself, so a normalized StreamTitle is usually enough
 * and AudD never hears about it.
 */

export const AUDD_MONTHLY_LIMIT_DEFAULT = 250;
export const AUDD_COOLDOWN_SECONDS = 60;
/** How long a station's last answer is treated as "still this song". */
export const STATION_FRESH_MS = 150_000;

export const RECOGNITION_ENABLED =
  process.env.NEXT_PUBLIC_RECOGNITION_ENABLED === "true";

export function auddMonthlyLimit(): number {
  const raw = Number(process.env.AUDD_MONTHLY_LIMIT);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return AUDD_MONTHLY_LIMIT_DEFAULT;
}

export function auddToken(): string {
  return (process.env.AUDD_API_TOKEN ?? "").trim();
}

export function recognitionMonth(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Lowercase, strip [bracketed] junk, collapse whitespace. The same song
 * coming through as "ARTIST - Title (Official)" and "artist - title" is one key.
 */
export function normalizeMetadataKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function songKey(artist: string, title: string): string {
  return normalizeMetadataKey(`${artist} ${title}`);
}

export type RecognitionGate = {
  enabled: boolean;
  hasToken: boolean;
  /** Signed-in (or a server refresh). Public listeners never spend. */
  canSpend: boolean;
  /** ICY parsed into a real title, or the raw string already resolved. */
  metadataResolved: boolean;
  stationFresh: boolean;
  cooldownOk: boolean;
  underLimit: boolean;
};

/** The one function that decides whether money leaves the house. */
export function mayCallAudd(gate: RecognitionGate): boolean {
  if (!gate.enabled || !gate.hasToken || !gate.canSpend) return false;
  if (gate.metadataResolved) return false;
  if (gate.stationFresh) return false;
  if (!gate.cooldownOk) return false;
  if (!gate.underLimit) return false;
  return true;
}

export type ResolvedSong = {
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
};
