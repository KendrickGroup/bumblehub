import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchOpenMeteoWeather } from "@/lib/weather/open-meteo";
import { getPropertyWeatherContext } from "@/lib/weather/property-location";

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
    return NextResponse.json({ status: "no_property" });
  }

  const context = await getPropertyWeatherContext(propertyId);
  if (!context) {
    return NextResponse.json({ status: "no_property" });
  }

  if (context.latitude == null || context.longitude == null) {
    return NextResponse.json({
      status: "no_location",
      locationLabel: context.locationLabel,
    });
  }

  try {
    const weather = await fetchOpenMeteoWeather(
      context.latitude,
      context.longitude,
      context.temperatureUnit,
    );

    const unitSymbol = context.temperatureUnit === "celsius" ? "C" : "F";

    return NextResponse.json({
      status: "ok",
      ...weather,
      unitSymbol,
      locationLabel: context.locationLabel,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch weather";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
