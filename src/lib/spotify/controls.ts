import type { PlaybackCommand } from "@/lib/music/types";
import { resolveSpotifyPlaybackDeviceId } from "./devices";
import { getValidSpotifyAccessToken, SpotifyNotConnectedError } from "./tokens";

export class SpotifyNoActiveDeviceError extends Error {
  readonly code = "NO_ACTIVE_DEVICE" as const;

  constructor(
    message = "Open Spotify on a device to start playback.",
  ) {
    super(message);
    this.name = "SpotifyNoActiveDeviceError";
  }
}

async function spotifyPlayerFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `https://api.spotify.com/v1/me/player${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
}

function isNoActiveDeviceBody(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("no_active_device") ||
    lower.includes("no active device") ||
    lower.includes("device not found") ||
    lower.includes("restriction violated")
  );
}

async function assertPlayerOk(response: Response, action: string): Promise<void> {
  if (
    response.status === 204 ||
    response.status === 200 ||
    response.status === 202
  ) {
    return;
  }

  const text = await response.text();

  if (
    response.status === 404 ||
    (response.status === 403 && isNoActiveDeviceBody(text)) ||
    isNoActiveDeviceBody(text)
  ) {
    throw new SpotifyNoActiveDeviceError();
  }

  if (response.status === 403) {
    throw new Error(
      "Spotify rejected the command. Check Premium and that a device is active.",
    );
  }

  throw new Error(`Spotify ${action} failed (${response.status}): ${text}`);
}

export async function executeSpotifyCommand(
  propertyId: string,
  cmd: PlaybackCommand,
): Promise<void> {
  let accessToken: string;
  try {
    accessToken = await getValidSpotifyAccessToken(propertyId);
  } catch (error) {
    if (error instanceof SpotifyNotConnectedError) {
      throw new Error("Spotify is not connected");
    }
    throw error;
  }

  let response: Response;

  try {
    switch (cmd.command) {
      case "play": {
        const deviceId = await resolveSpotifyPlaybackDeviceId(propertyId);
        response = await spotifyPlayerFetch(
          accessToken,
          `/play?device_id=${encodeURIComponent(deviceId)}`,
          {
            method: "PUT",
            body: JSON.stringify({}),
          },
        );
        await assertPlayerOk(response, "play");
        return;
      }
      case "pause":
        response = await spotifyPlayerFetch(accessToken, "/pause", {
          method: "PUT",
        });
        await assertPlayerOk(response, "pause");
        return;
      case "next":
        response = await spotifyPlayerFetch(accessToken, "/next", {
          method: "POST",
        });
        await assertPlayerOk(response, "next");
        return;
      case "previous":
        response = await spotifyPlayerFetch(accessToken, "/previous", {
          method: "POST",
        });
        await assertPlayerOk(response, "previous");
        return;
      case "setVolume": {
        const deviceId = await resolveSpotifyPlaybackDeviceId(propertyId);
        response = await spotifyPlayerFetch(
          accessToken,
          `/volume?volume_percent=${cmd.volume}&device_id=${encodeURIComponent(deviceId)}`,
          { method: "PUT" },
        );
        await assertPlayerOk(response, "setVolume");
        return;
      }
      case "setShuffle":
        response = await spotifyPlayerFetch(
          accessToken,
          `/shuffle?state=${cmd.shuffle}`,
          { method: "PUT" },
        );
        await assertPlayerOk(response, "setShuffle");
        return;
      default: {
        const _exhaustive: never = cmd;
        throw new Error(`Unsupported command: ${JSON.stringify(_exhaustive)}`);
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("No Spotify Connect devices") ||
        error.message.includes("Open Spotify on the Mac Mini"))
    ) {
      throw new SpotifyNoActiveDeviceError();
    }
    throw error;
  }
}
