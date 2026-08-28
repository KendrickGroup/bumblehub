const TTL_MS = 10 * 60 * 1000;
const LOOKUP_MS = 3000;

type CacheEntry = { artworkUrl: string | null; expires: number };

const cache = new Map<string, CacheEntry>();

function cacheKey(artist: string | null, title: string): string {
  return `${(artist ?? "").trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

function upgradeArtworkUrl(url: string): string {
  return url.replace("100x100", "300x300");
}

/**
 * Look up cover art on iTunes. Failures return null and never throw.
 * Successful hits and empty results are cached ~10 minutes; network
 * timeouts are not cached so the next poll can retry.
 */
export async function lookupItunesArtwork(
  artist: string | null,
  title: string,
): Promise<string | null> {
  const trimmedTitle = title.trim();
  const trimmedArtist = (artist ?? "").trim();
  if (!trimmedTitle || !trimmedArtist) return null;

  const key = cacheKey(trimmedArtist, trimmedTitle);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.artworkUrl;

  const term = `${trimmedArtist} ${trimmedTitle}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_MS);

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=1`,
      {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "User-Agent": "BumbleHub/1.0 (https://bumblehub.dev)",
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as {
      results?: Array<{ artworkUrl100?: string }>;
    };
    const raw = body.results?.[0]?.artworkUrl100?.trim();
    const artworkUrl = raw ? upgradeArtworkUrl(raw) : null;
    cache.set(key, { artworkUrl, expires: Date.now() + TTL_MS });
    return artworkUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
