import { NextResponse } from "next/server";
import { resolveArchiveEpisodes } from "@/lib/radio/archive-audio";
import { isHttpsStreamUrl } from "@/lib/radio/types";
import { parseRssFeed } from "@/lib/radio/feed";

const TIMEOUT_MS = 25000;
const CACHE_MS = 60 * 60 * 1000;

type CacheEntry = {
  at: number;
  episodes: ReturnType<typeof parseRssFeed>;
};

const cache = new Map<string, CacheEntry>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feedUrl = (url.searchParams.get("url") ?? "").trim();
  if (!isHttpsStreamUrl(feedUrl)) {
    return NextResponse.json({ episodes: [] });
  }

  const hit = cache.get(feedUrl);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ episodes: hit.episodes });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "BumbleHub/1.0 (https://bumblehub.dev)" },
      redirect: "follow",
    });
    if (!response.ok) {
      return NextResponse.json({ episodes: [] });
    }
    const xml = await response.text();
    // Full feed — no episode cap. Shuffle happens on the client.
    const parsed = parseRssFeed(xml);
    const episodes = await resolveArchiveEpisodes(parsed);
    cache.set(feedUrl, { at: Date.now(), episodes });
    return NextResponse.json({ episodes });
  } catch {
    return NextResponse.json({ episodes: [] });
  } finally {
    clearTimeout(timer);
  }
}
