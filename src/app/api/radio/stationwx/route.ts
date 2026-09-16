import { NextResponse } from "next/server";
import {
  fetchStationWx,
  readStationWxCache,
  stationWxCacheKey,
  writeStationWxCache,
} from "@/lib/radio/station-wx";

const NO_STORE = { "Cache-Control": "no-store" };

function parseCoord(raw: string | null, min: number, max: number): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = parseCoord(url.searchParams.get("lat"), -90, 90);
  const lon = parseCoord(url.searchParams.get("lon"), -180, 180);
  if (lat == null || lon == null) {
    return NextResponse.json({ weather: null }, { headers: NO_STORE });
  }

  const key = stationWxCacheKey(lat, lon);
  const cached = readStationWxCache(key);
  if (cached !== undefined) {
    return NextResponse.json({ weather: cached }, { headers: NO_STORE });
  }

  try {
    const weather = await fetchStationWx(lat, lon);
    writeStationWxCache(key, weather);
    return NextResponse.json({ weather }, { headers: NO_STORE });
  } catch {
    writeStationWxCache(key, null);
    return NextResponse.json({ weather: null }, { headers: NO_STORE });
  }
}
