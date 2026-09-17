import type { RadioFeedEpisode } from "./feed";

const STORAGE_PREFIX = "bumblehub:radio-feed-played:";
const PLAYED_CAP = 200;

function episodeId(episode: RadioFeedEpisode): string {
  return episode.audioUrl;
}

function readPlayed(stationId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${stationId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(-PLAYED_CAP);
  } catch {
    return [];
  }
}

function writePlayed(stationId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${stationId}`,
      JSON.stringify(ids.slice(-PLAYED_CAP)),
    );
  } catch {
    // Quota or private mode — shuffle still works, just without memory.
  }
}

/**
 * Pick a random episode, skipping recently played IDs until the pool
 * would be empty, then reset memory. Remembers the pick (cap 200).
 */
export function pickFeedEpisodeIndex(
  stationId: string,
  episodes: RadioFeedEpisode[],
  currentUrl?: string | null,
): number {
  if (episodes.length === 0) return 0;
  const played = readPlayed(stationId);
  const playedSet = new Set(played);
  let candidates = episodes
    .map((_, index) => index)
    .filter((index) => !playedSet.has(episodeId(episodes[index]!)));
  let memory = played;
  if (candidates.length === 0) {
    memory = [];
    candidates = episodes
      .map((_, index) => index)
      .filter((index) => episodes[index]!.audioUrl !== currentUrl);
    if (candidates.length === 0) {
      candidates = episodes.map((_, index) => index);
    }
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  const id = episodeId(episodes[pick]!);
  writePlayed(stationId, [...memory.filter((item) => item !== id), id]);
  return pick;
}
