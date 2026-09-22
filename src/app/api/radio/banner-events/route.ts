/**
 * Ingest for banner impressions, expands and buys. Batched by the client, so
 * one request can carry a sitting's worth of impressions instead of one per
 * crossfade. Same privacy rules as the play log: nothing here identifies anyone.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  BANNER_EVENT_BATCH_MAX,
  BANNER_EVENT_KINDS,
  type BannerEventKind,
} from "@/lib/radio/analytics";
import {
  cleanSessionKey,
  ingestContext,
  readJson,
} from "@/lib/radio/analytics-ingest";

function accepted() {
  return new NextResponse(null, { status: 204 });
}

function text(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function isKind(value: string): value is BannerEventKind {
  return (BANNER_EVENT_KINDS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return accepted();
  const payload = body as Record<string, unknown>;
  const raw = Array.isArray(payload.events) ? payload.events : [];
  if (raw.length === 0) return accepted();

  const { isOwner, isPublic } = await ingestContext(request, payload.surface);
  const sessionKey = cleanSessionKey(payload.session_key);

  const rows = raw.slice(0, BANNER_EVENT_BATCH_MAX).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const event = item as Record<string, unknown>;
    const handle = text(event.product_handle, 120);
    const kind = text(event.kind, 20);
    if (!handle || !isKind(kind)) return [];
    return [
      {
        product_handle: handle,
        product_title: text(event.product_title, 200) || null,
        kind,
        station_call: text(event.station_call, 80) || null,
        is_owner: isOwner,
        is_public: isPublic,
        session_key: sessionKey,
      },
    ];
  });

  if (rows.length === 0) return accepted();

  try {
    const service = createServiceClient();
    await service.from("banner_events").insert(rows);
  } catch {
    // Analytics never break the radio.
  }

  return accepted();
}
