export const RANCH_LAT = 38.39;
export const RANCH_LON = -120.8;
export const RANCH_TZ = "America/Los_Angeles";
export const RANCH_CITY = "Sutter Creek";
export const RANCH_STATE = "California";

/** Fourble public-domain classic baseball RSS (verified 916 https enclosures). */
export const FOURBLE_BASEBALL_RSS =
  "https://fourble.co.uk/cbotrarchive-240101-1.rss";

export const PUBLIC_RADIO_URL = "https://bumblehub.dev/radio";
export const PUBLIC_ROUNDUP_PLAYLIST_URL = (
  process.env.NEXT_PUBLIC_ROUNDUP_PLAYLIST_URL ?? ""
).trim();
export const LATIGO_COWBOY_URL = "https://latigocowboy.com";

export type RadioBand = "fm" | "am";
export type RadioStationType = "stream" | "feed";
export type RadioFaceBand = RadioBand | "wx";

export const RADIO_BANDS: RadioFaceBand[] = ["fm", "am", "wx"];

export function presetsForBand<T extends { band: RadioBand }>(
  stations: T[],
  band: RadioBand,
  cap: number,
): T[] {
  return stations.filter((s) => s.band === band).slice(0, cap);
}

export function milesFromRanch(lat: number, lon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 3958.8;
  const dLat = toRad(lat - RANCH_LAT);
  const dLon = toRad(lon - RANCH_LON);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(RANCH_LAT)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatMiles(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatEpisodeDate(raw: string | null | undefined): string {
  return formatFeedAirDate(raw) ?? "Classic";
}

/** Original air date for archive episodes, or null when it wouldn't add info. */
export function formatFeedAirDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatStationTime(timeZone: string | null | undefined): string {
  const tz = timeZone && timeZone.includes("/") ? timeZone : RANCH_TZ;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
  }
}

export const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

export const US_STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
  DC: "America/New_York",
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_NAMES).map(([code, name]) => [
    name.toLowerCase(),
    code,
  ]),
);

export function stateCodeFromLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  if (NAME_TO_CODE[lower]) return NAME_TO_CODE[lower]!;
  const afterComma = trimmed.split(",").pop()?.trim().toLowerCase() ?? "";
  if (NAME_TO_CODE[afterComma]) return NAME_TO_CODE[afterComma]!;
  if (/^[A-Za-z]{2}$/.test(afterComma)) return afterComma.toUpperCase();
  return null;
}

export function timezoneFromStateCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return US_STATE_TIMEZONES[code.toUpperCase()] ?? null;
}

export function needlePercent(
  band: RadioFaceBand,
  frequency: string | null | undefined,
): number {
  if (band === "wx") return 20;
  const raw = (frequency ?? "").replace(/[^\d.]/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 50;
  if (band === "am") {
    const t = (n - 540) / (1700 - 540);
    return 4 + Math.min(1, Math.max(0, t)) * 92;
  }
  const t = (n - 88) / (108 - 88);
  return 4 + Math.min(1, Math.max(0, t)) * 92;
}

export function spotifySearchUrl(title: string, artist: string | null): string {
  const q = [title, artist].filter(Boolean).join(" ").trim();
  return `https://open.spotify.com/search/${encodeURIComponent(q || title)}`;
}
