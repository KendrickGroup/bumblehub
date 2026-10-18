/**
 * Signed-in CSV of every radio offer signup.
 * Middleware keeps /api/settings off the radio host and behind a session.
 * getUser is the second door. The service key is the only reader of the table.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllSignups, signupsToCsv } from "@/lib/radio/signup-report";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const csv = signupsToCsv(await fetchAllSignups());
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="latigo-radio-signups.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not build the download." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
