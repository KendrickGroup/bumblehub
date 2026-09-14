import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublicRadioPropertyId } from "@/lib/radio/public-property";
import {
  RADIO_STATION_COLUMNS,
  normalizeRadioStation,
  type RadioStation,
} from "@/lib/radio/types";
import { ensureWxStreamUrl } from "@/lib/radio/wx-stream";

export async function GET() {
  try {
    const propertyId = await getPublicRadioPropertyId();
    if (!propertyId) {
      return NextResponse.json({ stations: [], wx_stream_url: "" });
    }
    const service = createServiceClient();
    const { data } = await service
      .from("radio_stations")
      .select(RADIO_STATION_COLUMNS)
      .eq("property_id", propertyId)
      .eq("is_visible", true)
      .order("display_order", { ascending: true });

    const stations = ((data as RadioStation[] | null) ?? [])
      .map(normalizeRadioStation)
      .map((s) => ({
        id: s.id,
        city_label: s.city_label,
        station_name: s.station_name,
        stream_url: s.stream_url,
        call_sign: s.call_sign,
        frequency: s.frequency,
        band: s.band,
        station_type: s.station_type,
        latitude: s.latitude,
        longitude: s.longitude,
        state_code: s.state_code,
        timezone: s.timezone,
        is_visible: true,
        display_order: s.display_order,
        property_id: "",
        created_at: "",
      }));

    const wx_stream_url = await ensureWxStreamUrl(service, propertyId);
    return NextResponse.json({ stations, wx_stream_url });
  } catch {
    return NextResponse.json({ stations: [], wx_stream_url: "" });
  }
}
