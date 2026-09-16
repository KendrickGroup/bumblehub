import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { ensureLaunchStations } from "@/lib/radio/queries";
import { ensureWxStreamUrl } from "@/lib/radio/wx-stream";
import { fetchChartArt } from "@/lib/radio/chart-art";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json({
      stations: [],
      wx_stream_url: "",
      chart_art: {},
      hasProperty: false,
    });
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const stations = await ensureLaunchStations(propertyId);
  const wx_stream_url = await ensureWxStreamUrl(supabase, propertyId);
  const chart_art = await fetchChartArt(supabase, propertyId);

  return NextResponse.json({
    stations: all ? stations : stations.filter((s) => s.is_visible),
    wx_stream_url,
    chart_art,
    hasProperty: true,
  });
}
