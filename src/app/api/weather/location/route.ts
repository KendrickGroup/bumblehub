import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchOpenMeteoWeather, lookupUsZip } from "@/lib/weather/open-meteo";
import {
  getPropertyWeatherContext,
  savePropertyLocation,
} from "@/lib/weather/property-location";

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as {
    zip?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    displayName?: unknown;
  };

  try {
    let latitude: number;
    let longitude: number;
    let displayName: string | undefined;

    if (typeof payload.zip === "string" && payload.zip.trim()) {
      const zipResult = await lookupUsZip(payload.zip.trim());
      latitude = zipResult.latitude;
      longitude = zipResult.longitude;
      displayName = zipResult.displayName;
    } else if (
      typeof payload.latitude === "number" &&
      typeof payload.longitude === "number"
    ) {
      latitude = payload.latitude;
      longitude = payload.longitude;
      displayName =
        typeof payload.displayName === "string"
          ? payload.displayName
          : "Current location";
    } else {
      return NextResponse.json(
        { error: "Provide a ZIP code or latitude and longitude." },
        { status: 400 },
      );
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
    }

    await savePropertyLocation(propertyId, latitude, longitude, displayName);

    const context = await getPropertyWeatherContext(propertyId);
    if (!context) {
      return NextResponse.json({ ok: true });
    }

    const weather = await fetchOpenMeteoWeather(
      latitude,
      longitude,
      context.temperatureUnit,
    );

    const unitSymbol = context.temperatureUnit === "celsius" ? "C" : "F";

    return NextResponse.json({
      ok: true,
      weather: {
        status: "ok",
        ...weather,
        unitSymbol,
        locationLabel: displayName ?? context.locationLabel,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save location";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
