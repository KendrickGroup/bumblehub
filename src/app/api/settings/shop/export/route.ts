/**
 * Signed-in download of the banner rotation: framed squares plus manifest.csv.
 * The public radio never reaches this. Middleware already keeps /api/settings
 * off the radio host and behind a session; getUser is the second door.
 *
 * sharp is imported inside the handler so a missing libvips comes back as JSON
 * instead of an uncaught module-load crash.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchBanner } from "@/lib/radio/banner";

export const runtime = "nodejs";
export const maxDuration = 60;

function failure(error: string, succeeded = 0, skipped = 0) {
  return NextResponse.json(
    { error, succeeded, skipped },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json(
      { error: "No default property configured" },
      { status: 400 },
    );
  }

  try {
    const { openBannerExport } = await import("@/lib/radio/banner-export");
    const banner = await fetchBanner(supabase, propertyId);
    const stream = openBannerExport(banner.picks);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="latigo-banner-products.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not build the download.";
    return failure(message);
  }
}
