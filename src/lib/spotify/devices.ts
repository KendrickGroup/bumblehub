import type { MusicDevice } from "@/lib/music/types";
import { spotifyApiFetch } from "./http";
import {
  loadSpotifyIntegrationConfig,
  saveSpotifyDevicePreference,
} from "./integration";
import { SpotifyNotConnectedError, getValidSpotifyAccessToken } from "./tokens";

type SpotifyDevice = {
  id: string;
  is_active: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
};

type SpotifyDevicesResponse = {
  devices: SpotifyDevice[];
};

const DEFAULT_NAME_HINTS = ["mac mini", "macmini"];

function deviceNameHints(
  configName?: string,
): string[] {
  const envHint = process.env.SPOTIFY_DEVICE_NAME?.trim();
  const hints = [
    ...(configName ? [configName.toLowerCase()] : []),
    ...(envHint ? [envHint.toLowerCase()] : []),
    ...DEFAULT_NAME_HINTS,
  ];
  return [...new Set(hints)];
}

function matchesNameHint(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

export async function fetchSpotifyDevices(
  propertyId: string,
): Promise<MusicDevice[]> {
  try {
    await getValidSpotifyAccessToken(propertyId);
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      return [];
    }
    throw error;
  }

  const response = await spotifyApiFetch(propertyId, "/me/player/devices");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify devices failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as SpotifyDevicesResponse;
  return (payload.devices ?? [])
    .filter((d) => !d.is_restricted)
    .map((d) => ({
      id: d.id,
      name: d.name,
      isActive: d.is_active,
      type: d.type,
    }));
}

export async function resolveSpotifyPlaybackDeviceId(
  propertyId: string,
  devices?: MusicDevice[],
): Promise<string> {
  const list = devices ?? (await fetchSpotifyDevices(propertyId));
  if (list.length === 0) {
    throw new Error(
      "No Spotify Connect devices found. Open Spotify on the Mac Mini.",
    );
  }

  const config = await loadSpotifyIntegrationConfig(propertyId);
  const hints = deviceNameHints(config.spotify_device_name);

  if (config.spotify_device_id) {
    const saved = list.find((d) => d.id === config.spotify_device_id);
    if (saved) return saved.id;
  }

  const byHint = list.find((d) => matchesNameHint(d.name, hints));
  if (byHint) {
    await saveSpotifyDevicePreference(propertyId, byHint.id, byHint.name);
    return byHint.id;
  }

  const active = list.find((d) => d.isActive);
  if (active) {
    await saveSpotifyDevicePreference(propertyId, active.id, active.name);
    return active.id;
  }

  const computer = list.find((d) => d.type === "Computer");
  const chosen = computer ?? list[0]!;
  await saveSpotifyDevicePreference(propertyId, chosen.id, chosen.name);
  return chosen.id;
}
