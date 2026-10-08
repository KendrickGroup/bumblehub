/**
 * Signed-in download of the banner rotation: framed squares plus manifest.csv.
 * The public radio never reaches this. Middleware already keeps /api/settings
 * off the radio host and behind a session; getUser is the second door.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchBanner } from "@/lib/radio/banner";
import { buildBannerExport } from "@/lib/radio/banner-export";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const banner = await fetchBanner(supabase, propertyId);
  const { zip } = await buildBannerExport(banner.picks);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="latigo-banner-products.zip"',
      "Cache-Control": "no-store",
    },
  });
}
