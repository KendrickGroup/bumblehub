import { createClient } from "@/lib/supabase/server";
import type { TemperatureUnit } from "./open-meteo";

export type PropertyWeatherContext = {
  propertyId: string;
  latitude: number | null;
  longitude: number | null;
  temperatureUnit: TemperatureUnit;
  locationLabel: string | null;
};

function parseTemperatureUnit(value: string | null | undefined): TemperatureUnit {
  return value === "celsius" ? "celsius" : "fahrenheit";
}

function readLocationLabel(dashboardLayout: unknown): string | null {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return null;
  const label = (dashboardLayout as Record<string, unknown>).weatherLocationLabel;
  return typeof label === "string" ? label : null;
}

export async function getPropertyWeatherContext(
  propertyId: string,
): Promise<PropertyWeatherContext | null> {
  const supabase = await createClient();

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, location_lat, location_lng")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError || !property) {
    return null;
  }

  const { data: settings } = await supabase
    .from("property_settings")
    .select("temperature_unit, dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  const lat =
    property.location_lat != null ? Number(property.location_lat) : null;
  const lng =
    property.location_lng != null ? Number(property.location_lng) : null;

  return {
    propertyId: property.id,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    temperatureUnit: parseTemperatureUnit(settings?.temperature_unit),
    locationLabel: readLocationLabel(settings?.dashboard_layout),
  };
}

export async function savePropertyLocation(
  propertyId: string,
  latitude: number,
  longitude: number,
  displayName?: string | null,
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: propertyError } = await supabase
    .from("properties")
    .update({
      location_lat: latitude,
      location_lng: longitude,
      ...(displayName ? { address: displayName } : {}),
      updated_at: now,
    })
    .eq("id", propertyId);

  if (propertyError) {
    throw new Error(`Failed to save location: ${propertyError.message}`);
  }

  if (displayName) {
    const { data: settings } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();

    const layout =
      settings?.dashboard_layout &&
      typeof settings.dashboard_layout === "object"
        ? { ...(settings.dashboard_layout as Record<string, unknown>) }
        : {};

    layout.weatherLocationLabel = displayName;

    const { error: settingsError } = await supabase
      .from("property_settings")
      .update({
        dashboard_layout: layout,
        updated_at: now,
      })
      .eq("property_id", propertyId);

    if (settingsError) {
      throw new Error(
        `Failed to save location label: ${settingsError.message}`,
      );
    }
  }
}
