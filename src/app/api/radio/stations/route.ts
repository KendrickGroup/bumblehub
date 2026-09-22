import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { ensureLaunchStations } from "@/lib/radio/queries";
import { ensureWxStreamUrl } from "@/lib/radio/wx-stream";
import { fetchChartArt } from "@/lib/radio/chart-art";
import {
  ensureBannerLines,
  BANNER_ROTATE_DEFAULT_SEC,
  DEFAULT_BANNER_CARD,
} from "@/lib/radio/banner";
import { fetchRoundupPlaylist } from "@/lib/radio/roundup-playlist";

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
      banner_images: [],
      banner_lines: [],
      banner_products: [],
      banner_rotate_seconds: BANNER_ROTATE_DEFAULT_SEC,
      banner_show_price: DEFAULT_BANNER_CARD.showPrice,
      banner_buy_label: DEFAULT_BANNER_CARD.buyLabel,
      roundup_playlist_url: "",
      hasProperty: false,
    });
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const stations = await ensureLaunchStations(propertyId);
  const wx_stream_url = await ensureWxStreamUrl(supabase, propertyId);
  const chart_art = await fetchChartArt(supabase, propertyId);
  const banner = await ensureBannerLines(supabase, propertyId);
  const roundup_playlist_url = await fetchRoundupPlaylist(supabase, propertyId);

  return NextResponse.json({
    stations: all ? stations : stations.filter((s) => s.is_visible),
    wx_stream_url,
    chart_art,
    banner_images: banner.images,
    banner_lines: banner.lines,
    banner_products: banner.products,
    banner_rotate_seconds: banner.rotateSeconds,
    banner_show_price: banner.card.showPrice,
    banner_buy_label: banner.card.buyLabel,
    roundup_playlist_url,
    hasProperty: true,
  });
}
