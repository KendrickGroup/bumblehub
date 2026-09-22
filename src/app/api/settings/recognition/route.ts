import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RECOGNITION_ENABLED,
  auddMonthlyLimit,
  auddToken,
} from "@/lib/radio/recognition";
import { fetchAuddUsage } from "@/lib/radio/recognition-store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await fetchAuddUsage();
  const hasToken = Boolean(auddToken());

  return NextResponse.json(
    {
      enabled: RECOGNITION_ENABLED,
      hasToken,
      limit: auddMonthlyLimit(),
      month: usage.month,
      calls: usage.calls,
      stations: usage.stations,
      reason: !RECOGNITION_ENABLED
        ? "Off. Set NEXT_PUBLIC_RECOGNITION_ENABLED to true in Vercel."
        : !hasToken
          ? "AUDD_API_TOKEN is not set. Recognition stays off."
          : usage.calls >= usage.limit
            ? "This month's ceiling is hit. Falling back to metadata."
            : null,
    },
    { headers: NO_STORE },
  );
}
