import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/radio/analytics-ingest";
import { subscribeToKlaviyo } from "@/lib/radio/klaviyo";
import {
  cleanEmail,
  cleanStationCall,
  LATIGO_LIST_COOKIE,
  LATIGO_LIST_COOKIE_MAX_AGE,
} from "@/lib/radio/latigo-list";

/**
 * Joining the Latigo List, from either radio.
 *
 * Public on purpose: there is no session on the public radio. The service key
 * never leaves this file's process, and the only thing a caller can do is add
 * an address — nothing here reads the list back.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const USER_AGENT_MAX = 400;

/** Per instance and per hour. Serverless spreads it thin, which is fine: this
 *  is here to stop a script hammering one lambda, not to be a real quota. */
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
    // Keep the map from growing without bound on a long-lived instance.
    for (const [key, times] of attempts) {
      if (times.every((at) => now - at >= WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function sorry(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Safari throws away script-written cookies after seven days, so the gate's
 *  permanent off switch has to arrive in a response header. */
function stampCookie(response: NextResponse, request: Request) {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    new URL(request.url).protocol.replace(":", "");
  const secure = proto === "https" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${LATIGO_LIST_COOKIE}=1; Path=/; Max-Age=${LATIGO_LIST_COOKIE_MAX_AGE}; SameSite=Lax${secure}`,
  );
}

export async function POST(request: Request) {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  const email = cleanEmail(body?.email);

  if (!email) {
    return sorry("That email doesn't look right. Mind checking it?", 400);
  }

  if (rateLimited(clientIp(request))) {
    return sorry("That's a few tries in a row. Give it an hour.", 429);
  }

  const stationCall = cleanStationCall(body?.station_call);
  const isPwa = body?.is_pwa === true;
  const userAgent =
    request.headers.get("user-agent")?.slice(0, USER_AGENT_MAX) ?? null;

  let wrote = false;
  let db: ReturnType<typeof createServiceClient> | null = null;
  let firstStation = stationCall;

  try {
    db = createServiceClient();
    // The station they first tuned is the interesting one, so a second signup
    // from a different dial does not overwrite it.
    const { data: existing } = await db
      .from("radio_subscribers")
      .select("station_call")
      .eq("email", email)
      .maybeSingle();
    firstStation = existing?.station_call ?? stationCall;

    const { error } = await db.from("radio_subscribers").upsert(
      {
        email,
        source: "latigo_radio",
        station_call: firstStation,
        is_pwa: isPwa,
        user_agent: userAgent,
      },
      { onConflict: "email" },
    );
    if (error) throw new Error(error.message);
    wrote = true;
  } catch (error) {
    console.error("[latigo-list] could not record subscriber", error);
  }

  const klaviyo = await subscribeToKlaviyo({
    email,
    stationCall: firstStation,
  });

  if (!klaviyo.ok) {
    console.warn(`[latigo-list] ${klaviyo.reason}`);
  }

  if (wrote && db) {
    const { error } = await db
      .from("radio_subscribers")
      .update(
        klaviyo.ok
          ? {
              klaviyo_synced: true,
              klaviyo_synced_at: new Date().toISOString(),
              klaviyo_error: null,
            }
          : { klaviyo_synced: false, klaviyo_error: klaviyo.reason },
      )
      .eq("email", email);
    if (error) {
      console.error("[latigo-list] could not stamp klaviyo state", error);
    }
  }

  // Nothing landed anywhere: the only case worth asking them to try again.
  if (!wrote && !klaviyo.ok) {
    return sorry("The wire's down. Try that again in a minute.", 502);
  }

  const response = NextResponse.json({ ok: true });
  stampCookie(response, request);
  return response;
}
