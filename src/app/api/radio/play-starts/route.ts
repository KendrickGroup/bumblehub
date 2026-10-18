/**
 * A play start from the public radio. No session, no email.
 * The row is the station name and a random visitor id from that browser.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/radio/analytics-ingest";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;

const attempts = new Map<string, number[]>();

function accepted() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) {
    for (const [key, times] of attempts) {
      if (times.every((at) => now - at >= WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function cleanStation(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const station = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!station || station.includes("@")) return "";
  return station;
}

function cleanVisitor(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const id = raw.trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id) || id.includes("@")) return "";
  return id;
}

export async function POST(request: Request) {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const station = cleanStation(body?.station);
  const visitorId = cleanVisitor(body?.visitor_id);
  if (!station || !visitorId || rateLimited(clientIp(request))) return accepted();

  try {
    const db = createServiceClient();
    await db.from("radio_plays").insert({ station, visitor_id: visitorId });
  } catch {
    // A missed count must not break playback.
  }

  return accepted();
}
