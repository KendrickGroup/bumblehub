import type { DeviceActionPayload, SceneAction } from "@/lib/types";
import {
  entityDomain,
  fetchHomeAssistantClientConfig,
  haCallService,
  haHello,
  HomeAssistantUnreachableError,
} from "./client";

export type SceneRunResult = {
  deviceTotal: number;
  deviceOk: number;
  unreachable: boolean;
};

function parseDevicePayload(raw: unknown): DeviceActionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const entity_id =
    typeof payload.entity_id === "string" ? payload.entity_id.trim() : "";
  const service = payload.service;
  if (!entity_id || (service !== "turn_on" && service !== "turn_off")) {
    return null;
  }
  const dataRaw = payload.data;
  let data: DeviceActionPayload["data"];
  if (dataRaw && typeof dataRaw === "object") {
    const brightness = (dataRaw as { brightness_pct?: unknown }).brightness_pct;
    if (typeof brightness === "number" && Number.isFinite(brightness)) {
      data = {
        brightness_pct: Math.max(0, Math.min(100, Math.round(brightness))),
      };
    }
  }
  return { entity_id, service, data };
}

function playlistIdFromPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  if (typeof payload.playlist_id === "string" && payload.playlist_id) {
    return payload.playlist_id;
  }
  if (typeof payload.playlistId === "string" && payload.playlistId) {
    return payload.playlistId;
  }
  if (typeof payload.uri === "string") {
    const parts = payload.uri.split(":");
    const idx = parts.lastIndexOf("playlist");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]!;
  }
  return null;
}

async function runNonDeviceAction(action: SceneAction): Promise<void> {
  if (action.action_type === "play_spotify_playlist") {
    const playlistId = playlistIdFromPayload(action.payload);
    if (!playlistId) return;
    await fetch("/api/music/playlists/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistId }),
    });
    return;
  }

  if (action.action_type === "pause_music") {
    await fetch("/api/music/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "pause" }),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function runSceneActions(
  actions: SceneAction[],
): Promise<SceneRunResult> {
  const ordered = [...actions].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const deviceActions = ordered.filter((a) => a.action_type === "set_device_state");
  const result: SceneRunResult = {
    deviceTotal: deviceActions.length,
    deviceOk: 0,
    unreachable: false,
  };

  let ha: { url: string; token: string } | null = null;

  if (deviceActions.length > 0) {
    try {
      const config = await fetchHomeAssistantClientConfig();
      if (!config.connected || !config.url || !config.token) {
        result.unreachable = true;
      } else {
        await haHello(config.url, config.token);
        ha = { url: config.url, token: config.token };
      }
    } catch {
      result.unreachable = true;
    }
  }

  for (const action of ordered) {
    if (action.delay_seconds > 0) {
      await sleep(action.delay_seconds * 1000);
    }

    if (action.action_type === "set_device_state") {
      if (!ha) continue;
      const payload = parseDevicePayload(action.payload);
      if (!payload) continue;
      try {
        const body: Record<string, unknown> = {
          entity_id: payload.entity_id,
          ...(payload.service === "turn_on" && payload.data
            ? payload.data
            : {}),
        };
        await haCallService(
          ha.url,
          ha.token,
          entityDomain(payload.entity_id),
          payload.service,
          body,
        );
        result.deviceOk += 1;
      } catch (err) {
        if (err instanceof HomeAssistantUnreachableError) {
          result.unreachable = true;
        }
      }
      continue;
    }

    try {
      await runNonDeviceAction(action);
    } catch {
      // Non-device failures never block the rest of the scene.
    }
  }

  return result;
}
