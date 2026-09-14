export type RadioNowPlayingTrack = {
  title: string;
  artist: string | null;
  artworkUrl: string | null;
};

function decodeLatin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

const SLOGAN_RE =
  /\b(?:https?:\/\/|www\.|\.(?:com|net|org|fm)\b|listen\s+live|streaming\s+live|the\s+best\s+(?:of\s+)?(?:country|hits)|your\s+(?:home|hit|country)\s+for)\b/i;
const CALL_ONLY_RE = /^[KW][A-Z]{2,3}(?:-FM)?(?:\s+\d{2,3}(?:\.\d{1,2})?)?$/i;
const FREQ_ONLY_RE = /^\d{2,4}(?:\.\d{1,2})?$/;

/** True when a StreamTitle part is real song text, not empty/junk. */
export function isUsableSongText(value: string): boolean {
  const text = value.trim();
  if (text.length < 2) return false;
  const letters = text.replace(/[^\p{L}\p{N}]+/gu, "");
  return letters.length >= 2;
}

function isSloganSpam(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (SLOGAN_RE.test(text)) return true;
  if (CALL_ONLY_RE.test(text)) return true;
  if (FREQ_ONLY_RE.test(text)) return true;
  return false;
}

export function parseIcyStreamTitle(raw: string): RadioNowPlayingTrack | null {
  const match = /StreamTitle='([^']*)'/i.exec(raw);
  const value = (match ? match[1] : raw).trim();
  if (!isUsableSongText(value) || isSloganSpam(value)) return null;

  const split = value.split(/\s+[-–—]\s+/);
  if (split.length >= 2) {
    const artist = split[0]!.trim();
    const title = split.slice(1).join(" - ").trim();
    if (isUsableSongText(title) && !isSloganSpam(title)) {
      return {
        title,
        artist: isUsableSongText(artist) && !isSloganSpam(artist) ? artist : null,
        artworkUrl: null,
      };
    }
    return null;
  }

  // No Artist - Title pair: station slogan / filler, not a song.
  return null;
}

function parseStreamTitle(raw: string): RadioNowPlayingTrack | null {
  return parseIcyStreamTitle(raw);
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
