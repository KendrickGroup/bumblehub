import { NextResponse } from "next/server";
import { fetchIcyNowPlaying, isUsableSongText, type RadioNowPlayingTrack } from "@/lib/radio/icy";
import { lookupItunesArtwork } from "@/lib/radio/itunes-artwork";
import { isHttpsStreamUrl } from "@/lib/radio/types";
import { ingestContext } from "@/lib/radio/analytics-ingest";
import {
  RECOGNITION_ENABLED,
  auddToken,
  mayCallAudd,
  normalizeMetadataKey,
  songKey,
  type ResolvedSong,
} from "@/lib/radio/recognition";
import {
  cooldownElapsed,
  findRecognizedSong,
  monthUnderLimit,
  readStationNowPlaying,
  reserveAuddCall,
  saveRecognizedSong,
  stationIsFresh,
  tryLockStation,
  writeStationNowPlaying,
} from "@/lib/radio/recognition-store";
import { captureClip, recognizeClip, rehostRemoteArtwork } from "@/lib/radio/audd";

const NO_STORE = { "Cache-Control": "no-store" };
const MEMORY_MS = 20_000;

type CachedTrack = { at: number; track: RadioNowPlayingTrack | null };

const memory = new Map<string, CachedTrack>();
const inflight = new Set<string>();

function asTrack(song: ResolvedSong): RadioNowPlayingTrack {
  return {
    title: song.title,
    artist: song.artist,
    artworkUrl: song.artworkUrl,
  };
}

function jsonTrack(track: RadioNowPlayingTrack | null) {
  return NextResponse.json({ track }, { headers: NO_STORE });
}

function stationKey(call: string, streamUrl: string): string {
  return (call.trim() || streamUrl).slice(0, 80);
}

async function resolveFromMetadata(
  raw: string,
  parsed: RadioNowPlayingTrack,
): Promise<ResolvedSong> {
  const keys = [
    normalizeMetadataKey(raw),
    parsed.artist ? songKey(parsed.artist, parsed.title) : "",
  ].filter(Boolean);

  for (const key of keys) {
    const hit = await findRecognizedSong(key);
    if (hit) return hit;
  }

  let artworkUrl: string | null = null;
  if (parsed.artist && isUsableSongText(parsed.artist)) {
    try {
      const itunes = await lookupItunesArtwork(parsed.artist, parsed.title);
      artworkUrl =
        itunes && RECOGNITION_ENABLED
          ? ((await rehostRemoteArtwork(itunes, parsed.artist, parsed.title)) ?? itunes)
          : itunes;
    } catch {
      artworkUrl = null;
    }
  }

  const song: ResolvedSong = {
    title: parsed.title,
    artist: parsed.artist ?? "",
    album: null,
    artworkUrl,
  };
  if (song.artist) {
    const id = await saveRecognizedSong(songKey(song.artist, song.title), song, "metadata");
    if (keys[0] && keys[0] !== songKey(song.artist, song.title)) {
      await saveRecognizedSong(keys[0], song, "metadata");
    }
    void id;
  }
  return song;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const streamUrl = (url.searchParams.get("url") ?? "").trim();
  const call = (url.searchParams.get("call") ?? "").trim();
  const surface = url.searchParams.get("surface");
  if (!isHttpsStreamUrl(streamUrl)) {
    return jsonTrack(null);
  }

  const station = stationKey(call, streamUrl);
  const memKey = `${station}|${streamUrl}`;
  const hit = memory.get(memKey);
  if (hit && Date.now() - hit.at < MEMORY_MS) {
    return jsonTrack(hit.track);
  }

  const { isPublic, hasUser } = await ingestContext(request, surface);
  // Public radio may display a cached song. Only a signed-in session may spend.
  const canSpend = !isPublic && hasUser;

  try {
    const icy = await fetchIcyNowPlaying(streamUrl);
    const raw = icy ? `${icy.artist ?? ""} - ${icy.title}`.replace(/^\s-\s/, "") : "";
    const rawKey = raw ? normalizeMetadataKey(raw) : "";

    if (icy && isUsableSongText(icy.title)) {
      const song = await resolveFromMetadata(raw || icy.title, icy);
      const id = song.artist
        ? await saveRecognizedSong(songKey(song.artist, song.title), song, "metadata")
        : null;
      await writeStationNowPlaying(station, id, raw || icy.title);
      const track = asTrack(song);
      memory.set(memKey, { at: Date.now(), track });
      return jsonTrack(track);
    }

    if (rawKey) {
      const cached = await findRecognizedSong(rawKey);
      if (cached) {
        const id = await saveRecognizedSong(rawKey, cached, "audd");
        await writeStationNowPlaying(station, id, raw);
        const track = asTrack(cached);
        memory.set(memKey, { at: Date.now(), track });
        return jsonTrack(track);
      }
    }

    const current = await readStationNowPlaying(station);
    if (stationIsFresh(current) && current?.song) {
      const track = asTrack(current.song);
      memory.set(memKey, { at: Date.now(), track });
      return jsonTrack(track);
    }

    const underLimit = await monthUnderLimit();
    const allowed = mayCallAudd({
      enabled: RECOGNITION_ENABLED,
      hasToken: Boolean(auddToken()),
      canSpend,
      metadataResolved: false,
      stationFresh: stationIsFresh(current),
      cooldownOk: cooldownElapsed(current),
      underLimit,
    });

    if (!allowed || inflight.has(station)) {
      const fallback = current?.song ? asTrack(current.song) : null;
      memory.set(memKey, { at: Date.now(), track: fallback });
      return jsonTrack(fallback);
    }

    inflight.add(station);
    try {
      const locked = await tryLockStation(station);
      if (!locked) {
        const again = await readStationNowPlaying(station);
        const fallback = again?.song ? asTrack(again.song) : current?.song ? asTrack(current.song) : null;
        memory.set(memKey, { at: Date.now(), track: fallback });
        return jsonTrack(fallback);
      }

      const clip = await captureClip(streamUrl);
      if (!clip) {
        const fallback = current?.song ? asTrack(current.song) : null;
        memory.set(memKey, { at: Date.now(), track: fallback });
        return jsonTrack(fallback);
      }

      const reserved = await reserveAuddCall(station);
      if (reserved === null || reserved < 0) {
        const fallback = current?.song ? asTrack(current.song) : null;
        memory.set(memKey, { at: Date.now(), track: fallback });
        return jsonTrack(fallback);
      }

      const recognized = await recognizeClip(clip);
      if (!recognized) {
        memory.set(memKey, { at: Date.now(), track: current?.song ? asTrack(current.song) : null });
        return jsonTrack(current?.song ? asTrack(current.song) : null);
      }

      const id = await saveRecognizedSong(
        songKey(recognized.artist, recognized.title),
        recognized,
        "audd",
      );
      if (rawKey) await saveRecognizedSong(rawKey, recognized, "audd");
      await writeStationNowPlaying(station, id, raw || null);
      const track = asTrack(recognized);
      memory.set(memKey, { at: Date.now(), track });
      return jsonTrack(track);
    } finally {
      inflight.delete(station);
    }
  } catch {
    return jsonTrack(null);
  }
}
