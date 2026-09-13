import { NextResponse } from "next/server";
import { fetchRanchWeather } from "@/lib/radio/ranch-weather";
import { RANCH_LAT, RANCH_LON, RANCH_TZ } from "@/lib/radio/ranch";

let cached: { at: number; body: unknown } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.body);
  }
  try {
    const weather = await fetchRanchWeather(RANCH_LAT, RANCH_LON, RANCH_TZ);
    const body = { status: "ok" as const, ...weather };
    cached = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch weather";
    return NextResponse.json({ status: "error", error: message }, { status: 200 });
  }
}
