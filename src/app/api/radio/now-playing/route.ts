import { NextResponse } from "next/server";
import { fetchIcyNowPlaying } from "@/lib/radio/icy";
import { lookupItunesArtwork } from "@/lib/radio/itunes-artwork";
import { isHttpsStreamUrl } from "@/lib/radio/types";

const NO_STORE = { "Cache-Control": "no-store" };
const CACHE_MS = 45_000;

type CachedTrack = {
  at: number;
  track: {
    artist: string | null;
    title: string;
    artworkUrl: string | null;
  } | null;
};

const cache = new Map<string, CachedTrack>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const streamUrl = (url.searchParams.get("url") ?? "").trim();
  if (!isHttpsStreamUrl(streamUrl)) {
    return NextResponse.json({ track: null }, { headers: NO_STORE });
  }

  const hit = cache.get(streamUrl);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ track: hit.track }, { headers: NO_STORE });
  }

  try {
    const track = await fetchIcyNowPlaying(streamUrl);
    if (!track) {
      cache.set(streamUrl, { at: Date.now(), track: null });
      return NextResponse.json({ track: null }, { headers: NO_STORE });
    }

    let artworkUrl: string | null = null;
    try {
      artworkUrl = await lookupItunesArtwork(track.artist, track.title);
    } catch {
      artworkUrl = null;
    }

    const payload = {
      artist: track.artist,
      title: track.title,
      artworkUrl,
    };
    cache.set(streamUrl, { at: Date.now(), track: payload });
    return NextResponse.json({ track: payload }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ track: null }, { headers: NO_STORE });
  }
}
