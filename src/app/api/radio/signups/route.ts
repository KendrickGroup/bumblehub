import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/radio/analytics-ingest";
import { cleanEmail } from "@/lib/radio/latigo-list";

/**
 * The 15% radio offer. Public on purpose: the radio has no session.
 * The service key stays here. A caller can add an address and cannot read
 * the list. A repeat address comes back as the same success, so the form
 * never says whether we already had it.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const SOURCE_MAX = 80;

/** Sent only after the address is stored. The radio page does not ship this. */
const OFFER_CODE = "LT15-9KQD";
const OFFER_SHOP_URL = "https://latigocowboy.com/discount/LT15-9KQD";

const attempts = new Map<string, number[]>();

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

function cleanSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const source = raw.trim().slice(0, SOURCE_MAX);
  return source || null;
}

export async function POST(request: Request) {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const email = cleanEmail(body?.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "That email doesn't look right. Mind checking it?" },
      { status: 400 },
    );
  }
  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "That's a few tries in a row. Give it an hour." },
      { status: 429 },
    );
  }

  try {
    const db = createServiceClient();
    const { error } = await db.from("radio_signups").upsert(
      { email, source: cleanSource(body?.source) },
      { onConflict: "email", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[radio-signups] could not save email", error);
    return NextResponse.json(
      { ok: false, error: "The wire's down. Try that again in a minute." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    code: OFFER_CODE,
    shopUrl: OFFER_SHOP_URL,
  });
}
