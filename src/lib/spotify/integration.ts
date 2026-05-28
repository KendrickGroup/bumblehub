import { createServiceClient } from "@/lib/supabase/server";

export type SpotifyIntegrationConfig = {
  spotify_device_id?: string;
  /** Substring match against Connect device names (e.g. "Mac mini"). */
  spotify_device_name?: string;
};

export function parseSpotifyConfig(raw: unknown): SpotifyIntegrationConfig {
  if (!raw || typeof raw !== "object") return {};
  const config = raw as Record<string, unknown>;
  return {
    spotify_device_id:
      typeof config.spotify_device_id === "string"
        ? config.spotify_device_id
        : undefined,
    spotify_device_name:
      typeof config.spotify_device_name === "string"
        ? config.spotify_device_name
        : undefined,
  };
}

export async function loadSpotifyIntegrationConfig(
  propertyId: string,
): Promise<SpotifyIntegrationConfig> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("config")
    .eq("property_id", propertyId)
    .eq("integration_type", "spotify")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Spotify config: ${error.message}`);
  }

  return parseSpotifyConfig(data?.config);
}

export async function saveSpotifyDevicePreference(
  propertyId: string,
  deviceId: string,
  deviceName: string,
): Promise<void> {
  const supabase = createServiceClient();
  const existing = await loadSpotifyIntegrationConfig(propertyId);
  const config: SpotifyIntegrationConfig = {
    ...existing,
    spotify_device_id: deviceId,
    spotify_device_name: deviceName,
  };

  const { error } = await supabase
    .from("integrations")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId)
    .eq("integration_type", "spotify");

  if (error) {
    throw new Error(`Failed to save Spotify device preference: ${error.message}`);
  }
}
