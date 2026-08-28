export type RadioNowPlayingTrack = {
  title: string;
  artist: string | null;
  artworkUrl: string | null;
};

function decodeLatin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

function parseStreamTitle(raw: string): RadioNowPlayingTrack | null {
  const match = /StreamTitle='([^']*)'/i.exec(raw);
  const value = (match?.[1] ?? "").trim();
  if (!value) return null;
  const split = value.split(/\s+-\s+/);
  if (split.length >= 2) {
    const artist = split[0]!.trim();
    const title = split.slice(1).join(" - ").trim();
    if (title) return { title, artist: artist || null, artworkUrl: null };
  }
  return { title: value, artist: null, artworkUrl: null };
}

/** Read a short ICY metadata block from a live stream. Returns null if none. */
export async function fetchIcyNowPlaying(
  streamUrl: string,
): Promise<RadioNowPlayingTrack | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(streamUrl, {
      headers: {
        "Icy-MetaData": "1",
        "User-Agent": "BumbleHub/1.0 (https://bumblehub.dev)",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    const metaint = Number(
      response.headers.get("icy-metaint") ??
        response.headers.get("Icy-Metaint") ??
        "",
    );
    if (!response.ok || !response.body || !Number.isFinite(metaint) || metaint < 1) {
      return null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    const need = metaint + 1 + 4080;
    while (received < need) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
    }
    await reader.cancel().catch(() => {});

    const buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.length;
    }
    if (buf.length <= metaint) return null;
    const metaLen = buf[metaint]! * 16;
    if (metaLen === 0) return null;
    const start = metaint + 1;
    const end = Math.min(buf.length, start + metaLen);
    const text = decodeLatin1(buf.subarray(start, end));
    return parseStreamTitle(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
