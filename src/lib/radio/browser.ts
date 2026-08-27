import type { RadioSearchResult } from "./types";
import { isHttpsStreamUrl } from "./types";

const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

const USER_AGENT = "BumbleHub/0.1 (https://bumblehub.dev)";
const SEARCH_LIMIT = 25;

type BrowserStation = {
  stationuuid?: unknown;
  name?: unknown;
  country?: unknown;
  state?: unknown;
  bitrate?: unknown;
  url?: unknown;
  url_resolved?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapStation(raw: BrowserStation): RadioSearchResult | null {
  const streamUrl = asString(raw.url_resolved) || asString(raw.url);
  if (!isHttpsStreamUrl(streamUrl)) return null;
  const name = asString(raw.name);
  const stationuuid = asString(raw.stationuuid);
  if (!name || !stationuuid) return null;
  return {
    stationuuid,
    name,
    country: asString(raw.country),
    state: asString(raw.state),
    bitrate: asNumber(raw.bitrate),
    streamUrl,
  };
}

export async function searchRadioBrowser(
  query: string,
): Promise<RadioSearchResult[]> {
  const name = query.trim().slice(0, 80);
  if (name.length < 2) return [];

  const params = new URLSearchParams({
    name,
    is_https: "true",
    hidebroken: "true",
    limit: String(SEARCH_LIMIT),
    order: "votes",
    reverse: "true",
  });

  let lastError: Error | null = null;
  for (const origin of MIRRORS) {
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
      const seen = new Set<string>();
      const results: RadioSearchResult[] = [];
      for (const row of body) {
        const mapped = mapStation(row as BrowserStation);
        if (!mapped || seen.has(mapped.streamUrl)) continue;
        seen.add(mapped.streamUrl);
        results.push(mapped);
      }
      return results;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Radio Browser failed");
    }
  }

  throw lastError ?? new Error("Radio Browser unavailable");
}
