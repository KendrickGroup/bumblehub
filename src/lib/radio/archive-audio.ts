import "server-only";

/**
 * Archive.org /download links often 302 to a dead CDN node (we've seen
 * dn720206.ca.archive.org return 500). The item's own server in the
 * metadata API still has the file. Rewrite before the browser ever sees
 * the broken hop.
 */

const DOWNLOAD_RE =
  /^https?:\/\/(?:www\.)?archive\.org\/download\/([^/?#]+)\/([^?#]+)/i;

type IaLocation = {
  d1: string;
  dir: string;
};

const iaCache = new Map<string, IaLocation | null>();

function upgradeToHttps(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.href;
  } catch {
    return raw;
  }
}

async function iaLocation(identifier: string): Promise<IaLocation | null> {
  if (iaCache.has(identifier)) return iaCache.get(identifier) ?? null;
  try {
    const response = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "BumbleHub/1.0 (https://bumblehub.dev)" },
      },
    );
    if (!response.ok) {
      iaCache.set(identifier, null);
      return null;
    }
    const body = (await response.json()) as { d1?: string; dir?: string };
    const d1 = body.d1?.trim();
    const dir = body.dir?.trim();
    const loc = d1 && dir ? { d1, dir } : null;
    iaCache.set(identifier, loc);
    return loc;
  } catch {
    iaCache.set(identifier, null);
    return null;
  }
}

/** Point an Archive.org download URL at the live item server, or the CORS mirror. */
export async function resolveArchiveAudioUrl(raw: string): Promise<string> {
  const httpsUrl = upgradeToHttps(raw);
  const match = DOWNLOAD_RE.exec(httpsUrl);
  if (!match) return httpsUrl;
  const identifier = match[1]!;
  const file = match[2]!;
  const loc = await iaLocation(identifier);
  if (loc) {
    const path = loc.dir.startsWith("/") ? loc.dir : `/${loc.dir}`;
    return `https://${loc.d1}${path}/${file}`;
  }
  return `https://archive.org/cors/${identifier}/${file}`;
}

export async function resolveArchiveEpisodes<T extends { audioUrl: string }>(
  episodes: T[],
): Promise<T[]> {
  const identifiers = new Set<string>();
  for (const episode of episodes) {
    const match = DOWNLOAD_RE.exec(upgradeToHttps(episode.audioUrl));
    if (match) identifiers.add(match[1]!);
  }
  await Promise.all([...identifiers].map((id) => iaLocation(id)));
  return Promise.all(
    episodes.map(async (episode) => ({
      ...episode,
      audioUrl: await resolveArchiveAudioUrl(episode.audioUrl),
    })),
  );
}
