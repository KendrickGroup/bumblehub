import type { RadioSearchResult } from "./types";
import { isHttpsStreamUrl } from "./types";

const FALLBACK_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

const USER_AGENT = "BumbleHub/1.0 (https://bumblehub.dev)";
const SEARCH_LIMIT = 40;

let cachedMirrors: string[] | null = null;

export const RADIO_GENRES = [
  { id: "classic-country", label: "Classic Country" },
  { id: "todays-country", label: "Today's Country" },
  { id: "texas-red-dirt", label: "Texas & Red Dirt" },
  { id: "bluegrass", label: "Bluegrass" },
  { id: "western-cowboy", label: "Western & Cowboy" },
  { id: "gospel", label: "Gospel" },
] as const;

export type RadioGenreId = (typeof RADIO_GENRES)[number]["id"];

export const RANCH_SUGGESTIONS = [
  { id: "wsm", query: "WSM 650", name: "WSM 650", city: "Nashville" },
  { id: "kuzz", query: "KUZZ", name: "KUZZ", city: "Bakersfield" },
  { id: "kfwr", query: "KFWR The Ranch", name: "KFWR 95.9 The Ranch", city: "Fort Worth" },
  { id: "koke", query: "KOKE-FM", name: "KOKE-FM", city: "Austin" },
  { id: "kghl", query: "KGHL 790", name: "KGHL 790", city: "Billings" },
  { id: "knci", query: "KNCI 105.1", name: "KNCI 105.1", city: "Sacramento" },
  { id: "kscs", query: "KSCS 96.3", name: "KSCS 96.3", city: "Dallas" },
  { id: "reddirt", query: "Red Dirt Rebel", name: "The Red Dirt Rebel", city: "Lubbock" },
] as const;

export type RanchSuggestion = (typeof RANCH_SUGGESTIONS)[number];

type BrowserStation = {
  stationuuid?: unknown;
  name?: unknown;
  country?: unknown;
  countrycode?: unknown;
  state?: unknown;
  bitrate?: unknown;
  votes?: unknown;
  clickcount?: unknown;
  tags?: unknown;
  url?: unknown;
  url_resolved?: unknown;
};

type FetchOpts = {
  name?: string;
  tag?: string;
  countrycode?: string;
  order?: "votes" | "clickcount";
  limit?: number;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseTags(value: unknown): string[] {
  return asString(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function mapStation(raw: BrowserStation): RadioSearchResult | null {
  const resolved = asString(raw.url_resolved);
  const fallback = asString(raw.url);
  const streamUrl = isHttpsStreamUrl(resolved)
    ? resolved
    : isHttpsStreamUrl(fallback)
      ? fallback
      : "";
  if (!streamUrl) return null;
  const name = asString(raw.name);
  const stationuuid = asString(raw.stationuuid);
  if (!name || !stationuuid) return null;
  const tags = parseTags(raw.tags);
  return {
    stationuuid,
    name,
    country: asString(raw.country),
    countrycode: asString(raw.countrycode).toUpperCase(),
    state: asString(raw.state),
    bitrate: asNumber(raw.bitrate),
    votes: asNumber(raw.votes),
    clickcount: asNumber(raw.clickcount),
    tags: tags.slice(0, 8),
    streamUrl,
  };
}

function popularity(station: RadioSearchResult): number {
  const us =
    station.countrycode === "US" ||
    /united states/i.test(station.country)
      ? 1_000_000
      : 0;
  return us + station.votes * 20 + station.clickcount;
}

function mergeResults(groups: RadioSearchResult[][]): RadioSearchResult[] {
  const seen = new Set<string>();
  const out: RadioSearchResult[] = [];
  for (const group of groups) {
    for (const station of group) {
      const key = `${station.stationuuid}|${station.streamUrl}`;
      if (seen.has(key) || seen.has(station.streamUrl)) continue;
      seen.add(key);
      seen.add(station.streamUrl);
      out.push(station);
    }
  }
  out.sort((a, b) => popularity(b) - popularity(a));
  return out;
}

async function getMirrors(): Promise<string[]> {
  if (cachedMirrors && cachedMirrors.length > 0) return cachedMirrors;
  for (const origin of FALLBACK_MIRRORS) {
    try {
      const response = await fetch(`${origin}/json/servers`, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as unknown;
      if (!Array.isArray(body)) continue;
      const hosts = [
        ...new Set(
          body
            .map((row) =>
              typeof row === "object" && row && "name" in row
                ? asString((row as { name: unknown }).name)
                : "",
            )
            .filter(Boolean),
        ),
      ];
      if (hosts.length > 0) {
        cachedMirrors = hosts.map((host) => `https://${host}`);
        return cachedMirrors;
      }
    } catch {
      // try the next known origin
    }
  }
  return FALLBACK_MIRRORS;
}

async function fetchFromMirrors(
  params: URLSearchParams,
): Promise<RadioSearchResult[]> {
  let lastError: Error | null = null;
  const origins = [...new Set([...(await getMirrors()), ...FALLBACK_MIRRORS])];
  for (const origin of origins) {
    try {
      const response = await fetch(`${origin}/json/stations/search?${params}`, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        lastError = new Error(`Radio Browser ${response.status}`);
        continue;
      }
      const body = (await response.json()) as unknown;
      if (!Array.isArray(body)) return [];
      const results: RadioSearchResult[] = [];
      for (const row of body) {
        const mapped = mapStation(row as BrowserStation);
        if (mapped) results.push(mapped);
      }
      return results;
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error("Radio Browser failed");
    }
  }
  throw lastError ?? new Error("Radio Browser unavailable");
}

async function fetchStations(opts: FetchOpts): Promise<RadioSearchResult[]> {
  const params = new URLSearchParams({
    is_https: "true",
    hidebroken: "true",
    limit: String(opts.limit ?? SEARCH_LIMIT),
    order: opts.order ?? "votes",
    reverse: "true",
  });
  if (opts.name) params.set("name", opts.name.slice(0, 80));
  if (opts.tag) params.set("tag", opts.tag.slice(0, 80));
  if (opts.countrycode) params.set("countrycode", opts.countrycode);
  return fetchFromMirrors(params);
}

export async function searchRadioBrowser(
  query: string,
): Promise<RadioSearchResult[]> {
  const name = query.trim().slice(0, 80);
  if (name.length < 2) return [];
  const rows = await fetchStations({ name });
  return mergeResults([rows]);
}

export async function browseRadioGenre(
  genreId: RadioGenreId,
): Promise<RadioSearchResult[]> {
  switch (genreId) {
    case "classic-country":
      return mergeResults([await fetchStations({ tag: "classic country" })]);
    case "todays-country":
      return mergeResults([
        await fetchStations({
          tag: "country",
          countrycode: "US",
          order: "votes",
        }),
      ]);
    case "texas-red-dirt":
      return mergeResults([
        await fetchStations({ name: "red dirt" }),
        await fetchStations({ tag: "red dirt" }),
        await fetchStations({ name: "texas country" }),
        await fetchStations({ tag: "texas country" }),
      ]);
    case "bluegrass":
      return mergeResults([await fetchStations({ tag: "bluegrass" })]);
    case "western-cowboy":
      return mergeResults([
        await fetchStations({ name: "cowboy" }),
        await fetchStations({ tag: "western" }),
      ]);
    case "gospel": {
      const countryGospel = await fetchStations({ tag: "country gospel" });
      if (countryGospel.length > 0) return mergeResults([countryGospel]);
      return mergeResults([await fetchStations({ tag: "gospel" })]);
    }
    default:
      return [];
  }
}

function hasWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(
    haystack,
  );
}

function suggestionQueries(query: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const next = value.trim();
    if (
      next.length >= 2 &&
      !out.some((item) => item.toLowerCase() === next.toLowerCase())
    ) {
      out.push(next);
    }
  };
  add(query);
  add(query.replace(/-FM$/i, "").replace(/\s+FM$/i, ""));
  add(query.replace(/^the\s+/i, ""));
  const call = query.match(/\b([KW][A-Z]{2,3})\b/i);
  if (call?.[1]) add(call[1]);
  return out;
}

export function pickBestNamedMatch(
  query: string,
  results: RadioSearchResult[],
  city = "",
): RadioSearchResult | null {
  if (results.length === 0) return null;
  const tokens = query
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((t) => t.length >= 2 && !["the", "fm", "am"].includes(t));
  const call = tokens.find((t) => /^[kw][a-z]{2,3}$/.test(t));
  const cityKey = city.toLowerCase().trim();

  const ranked = results
    .map((station) => {
      const blob = `${station.name} ${station.state} ${station.country}`;
      if (call && !hasWord(station.name, call)) return null;
      if (!call) {
        const hits = tokens.filter((token) => hasWord(blob, token)).length;
        if (hits < Math.min(2, tokens.length)) return null;
      }
      let score = popularity(station);
      for (const token of tokens) {
        if (hasWord(station.name, token)) score += 80_000;
        else if (hasWord(blob, token)) score += 10_000;
      }
      if (cityKey && blob.toLowerCase().includes(cityKey)) score += 120_000;
      return { station, score };
    })
    .filter(
      (row): row is { station: RadioSearchResult; score: number } =>
        row !== null,
    )
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.station ?? null;
}

export async function resolveNamedStation(
  query: string,
  city = "",
): Promise<RadioSearchResult | null> {
  const groups = await Promise.all(
    suggestionQueries(query).map((name) => fetchStations({ name })),
  );
  return pickBestNamedMatch(query, mergeResults(groups), city);
}

export function isRadioGenreId(value: string): value is RadioGenreId {
  return RADIO_GENRES.some((genre) => genre.id === value);
}

export function displayTags(station: RadioSearchResult): string[] {
  return station.tags.slice(0, 2);
}

export function resultPlace(station: RadioSearchResult): string {
  if (station.state && station.countrycode === "US") return station.state;
  if (station.state && station.country) {
    return `${station.state}, ${station.country}`;
  }
  if (station.state) return station.state;
  if (station.countrycode === "US") return "USA";
  return station.country;
}

export function cityLabelFromResult(station: RadioSearchResult): string {
  if (station.state) return station.state.slice(0, 40);
  if (station.countrycode === "US") return "USA";
  return (station.country || "Radio").slice(0, 40);
}

export function normalizeStationKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function resultAlreadyOnDial(
  result: Pick<RadioSearchResult, "name" | "streamUrl">,
  stations: Array<{ station_name: string; stream_url: string }>,
): boolean {
  const url = normalizeStationKey(result.streamUrl);
  const name = normalizeStationKey(result.name);
  return stations.some((station) => {
    const existingUrl = normalizeStationKey(station.stream_url);
    const existingName = normalizeStationKey(station.station_name);
    return (
      (url && existingUrl === url) ||
      (name.length >= 3 &&
        (existingName === name ||
          existingName.includes(name) ||
          name.includes(existingName)))
    );
  });
}

export function suggestionAlreadyOnDial(
  suggestion: RanchSuggestion,
  stations: Array<{ station_name: string; stream_url: string }>,
): boolean {
  const keys = [suggestion.name, suggestion.query].map(normalizeStationKey);
  return stations.some((station) => {
    const existing = normalizeStationKey(station.station_name);
    return keys.some(
      (key) =>
        key.length >= 3 &&
        (existing === key || existing.includes(key) || key.includes(existing)),
    );
  });
}
