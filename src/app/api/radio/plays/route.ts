/**
 * Ingest for finished tunes. Open to the public radio because that is where
 * most listening happens; nothing personal is accepted or stored, and the row
 * is dropped unless it already crossed ten seconds of real playback.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  PLAY_MAX_SECONDS,
  PLAY_MIN_SECONDS,
} from "@/lib/radio/analytics";
import {
  cleanSessionKey,
  ingestContext,
  readJson,
} from "@/lib/radio/analytics-ingest";

const BANDS = new Set(["fm", "am", "sports", "wx"]);

/** Always 204: a listener never needs to know, and never needs to retry. */
function accepted() {
  return new NextResponse(null, { status: 204 });
}

function text(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return accepted();
  const row = body as Record<string, unknown>;

  const stationCall = text(row.station_call, 80);
  const band = text(row.band, 12).toLowerCase();
  const rawSeconds = Number(row.seconds);
  if (!stationCall || !BANDS.has(band) || !Number.isFinite(rawSeconds)) {
    return accepted();
  }

  const seconds = Math.min(PLAY_MAX_SECONDS, Math.floor(rawSeconds));
  if (seconds < PLAY_MIN_SECONDS) return accepted();

  const startedAtRaw = text(row.started_at, 40);
  const startedAt = Number.isFinite(Date.parse(startedAtRaw))
    ? new Date(startedAtRaw).toISOString()
    : new Date().toISOString();

  const { isOwner, isPublic } = await ingestContext(request, row.surface);

  try {
    const service = createServiceClient();
    await service.from("station_plays").insert({
      station_call: stationCall,
      station_id: text(row.station_id, 120) || null,
      band,
      started_at: startedAt,
      seconds,
      is_owner: isOwner,
      is_public: isPublic,
      session_key: cleanSessionKey(row.session_key),
    });
  } catch {
    // Analytics never break the radio.
  }

  return accepted();
}
