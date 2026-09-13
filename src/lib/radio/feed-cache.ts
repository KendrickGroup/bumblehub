"use client";

import type { RadioFeedEpisode } from "./feed";

type Entry = {
  episodes: RadioFeedEpisode[];
  at: number;
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<RadioFeedEpisode[]>>();
const TTL_MS = 60 * 60 * 1000;

export function peekFeedEpisodes(url: string): RadioFeedEpisode[] | null {
  const hit = cache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(url);
    return null;
  }
  return hit.episodes;
}

export async function loadFeedEpisodes(
  url: string,
): Promise<RadioFeedEpisode[]> {
  const cached = peekFeedEpisodes(url);
  if (cached) return cached;
  const existing = inflight.get(url);
  if (existing) return existing;

  const pending = (async () => {
    const response = await fetch(
      `/api/radio/feed?url=${encodeURIComponent(url)}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as { episodes?: RadioFeedEpisode[] };
    const episodes = Array.isArray(body.episodes) ? body.episodes : [];
    cache.set(url, { episodes, at: Date.now() });
    return episodes;
  })().finally(() => {
    inflight.delete(url);
  });

  inflight.set(url, pending);
  return pending;
}
