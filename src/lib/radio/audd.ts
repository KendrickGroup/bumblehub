import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { auddToken, type ResolvedSong } from "./recognition";

const AUDD_URL = "https://api.audd.io/";
const CLIP_BYTES = 180_000;
const CLIP_MS = 10_000;
const ART_MS = 6_000;
const SONG_ART_BUCKET = "song-art";

type AuddBody = {
  status?: string;
  result?: {
    artist?: string;
    title?: string;
    album?: string;
    spotify?: { album?: { images?: Array<{ url?: string }> } };
    apple_music?: { artwork?: { url?: string } };
  } | null;
};

export async function captureClip(streamUrl: string): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIP_MS);
  try {
    const response = await fetch(streamUrl, {
      headers: {
        "User-Agent": "BumbleHub/1.0 (https://bumblehub.dev)",
        // No ICY metadata: we want audio bytes, not a title block.
        "Icy-MetaData": "0",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < CLIP_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
    }
    await reader.cancel().catch(() => {});
    if (received < 8_000) return null;

    const buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.length;
    }
    return new Blob([buf], { type: "audio/mpeg" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function artworkFromAudd(result: NonNullable<AuddBody["result"]>): string | null {
  const apple = result.apple_music?.artwork?.url;
  if (apple) return apple.replace("{w}", "300").replace("{h}", "300");
  const spotify = result.spotify?.album?.images?.[0]?.url;
  return spotify?.trim() || null;
}

async function rehostArtwork(
  sourceUrl: string,
  key: string,
): Promise<string | null> {
  const db = (() => {
    try {
      return createServiceClient();
    } catch {
      return null;
    }
  })();
  if (!db) return null;

  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(ART_MS),
      cache: "no-store",
      headers: { "User-Agent": "BumbleHub/1.0 (https://bumblehub.dev)" },
    });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]!
      .trim();
    if (!type.startsWith("image/")) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 32 || bytes.byteLength > 2_000_000) return null;

    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `covers/${key.replace(/[^a-z0-9]+/g, "-").slice(0, 80)}.${ext}`;
    const { error } = await db.storage.from(SONG_ART_BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: type,
    });
    if (error) {
      console.warn("[recognition] art upload failed", error.message);
      return null;
    }
    const { data } = db.storage.from(SONG_ART_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

/**
 * One paid identification from an already-captured clip. Returns null on a
 * clean no-match or any failure. The caller has already reserved the slot.
 */
export async function recognizeClip(clip: Blob): Promise<ResolvedSong | null> {
  const token = auddToken();
  if (!token) return null;

  const body = new FormData();
  body.set("api_token", token);
  body.set("return", "apple_music,spotify");
  body.set("file", clip, "clip.mp3");

  try {
    const response = await fetch(AUDD_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[recognition] audd ${response.status}`);
      return null;
    }
    const json = (await response.json()) as AuddBody;
    const result = json.result;
    const title = result?.title?.trim();
    const artist = result?.artist?.trim();
    if (!result || !title || !artist) return null;

    const album = result.album?.trim() || null;
    const remoteArt = artworkFromAudd(result);
    const key = `${artist} ${title}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
    const artworkUrl = remoteArt ? await rehostArtwork(remoteArt, key) : null;

    return { title, artist, album, artworkUrl };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[recognition] audd unreachable: ${reason}`);
    return null;
  }
}

/** Capture a clip, then identify. Prefer capture + recognizeClip so a dead stream does not burn a monthly slot. */
export async function recognizeStream(streamUrl: string): Promise<ResolvedSong | null> {
  const clip = await captureClip(streamUrl);
  if (!clip) return null;
  return recognizeClip(clip);
}

export async function rehostRemoteArtwork(
  sourceUrl: string,
  artist: string,
  title: string,
): Promise<string | null> {
  const key = `${artist} ${title}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
  return rehostArtwork(sourceUrl, key);
}
