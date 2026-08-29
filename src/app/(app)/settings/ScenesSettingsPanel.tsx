"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Device,
  DeviceActionPayload,
  Scene,
  SceneAction,
} from "@/lib/types";

type DraftAction = {
  key: string;
  device_id: string;
  entity_id: string;
  service: "turn_on" | "turn_off";
  brightness_pct: number | null;
};

type Props = {
  hasProperty: boolean;
  initialScenes: Scene[];
  initialActions: SceneAction[];
  initialDevices: Device[];
};

function payloadFromAction(action: SceneAction): DeviceActionPayload | null {
  const payload = action.payload as DeviceActionPayload;
  if (
    typeof payload?.entity_id !== "string" ||
    (payload.service !== "turn_on" && payload.service !== "turn_off")
  ) {
    return null;
  }
  return payload;
}

function draftsForScene(
  sceneId: string,
  actions: SceneAction[],
  devices: Device[],
): DraftAction[] {
  return actions
    .filter(
      (a) => a.scene_id === sceneId && a.action_type === "set_device_state",
    )
    .map((action) => {
      const payload = payloadFromAction(action);
      const device = devices.find((d) => d.id === action.device_id);
      return {
        key: action.id,
        device_id: action.device_id ?? "",
        entity_id: payload?.entity_id ?? device?.external_id ?? "",
        service: payload?.service ?? "turn_on",
        brightness_pct:
          typeof payload?.data?.brightness_pct === "number"
            ? payload.data.brightness_pct
            : null,
      };
    });
}

function otherActionsForScene(
  sceneId: string,
  actions: SceneAction[],
): SceneAction[] {
  return actions.filter(
    (a) => a.scene_id === sceneId && a.action_type !== "set_device_state",
  );
}

function actionLabel(action: SceneAction): string {
  if (action.action_type === "play_spotify_playlist") {
    return "Spotify playlist";
  }
  if (action.action_type === "pause_music") return "Pause music";
  return action.action_type.replace(/_/g, " ");
}

function deviceSupportsBrightness(device: Device | undefined): boolean {
  if (!device) return false;
  if (device.device_type === "light") return true;
  if (device.external_id?.startsWith("light.")) return true;
  return Boolean(
    (device.capabilities as { supports_brightness?: unknown })
      .supports_brightness,
  );
}

export function ScenesSettingsPanel({
  hasProperty,
  initialScenes,
  initialActions,
  initialDevices,
}: Props) {
  const [actions, setActions] = useState(initialActions);
  const [devices, setDevices] = useState(initialDevices);
  const [drafts, setDrafts] = useState<Record<string, DraftAction[]>>(() => {
    const next: Record<string, DraftAction[]> = {};
    for (const scene of initialScenes) {
      next[scene.id] = draftsForScene(scene.id, initialActions, initialDevices);
    }
    return next;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const activeDevices = useMemo(
    () =>
      devices
        .filter((d) => d.is_active && d.protocol === "home_assistant")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  useEffect(() => {
    const refresh = () => {
      void (async () => {
        try {
          const response = await fetch("/api/devices", { cache: "no-store" });
          if (!response.ok) return;
          const body = (await response.json()) as { devices?: Device[] };
          if (body.devices) setDevices(body.devices);
        } catch {
          // Keep current list.
        }
      })();
    };
    window.addEventListener("bumblehub:devices-changed", refresh);
    return () =>
      window.removeEventListener("bumblehub:devices-changed", refresh);
  }, []);

  const addAction = (sceneId: string) => {
    const first = activeDevices[0];
    setDrafts((prev) => ({
      ...prev,
      [sceneId]: [
        ...(prev[sceneId] ?? []),
        {
          key: `new-${crypto.randomUUID()}`,
          device_id: first?.id ?? "",
          entity_id: first?.external_id ?? "",
          service: "turn_on",
          brightness_pct: deviceSupportsBrightness(first) ? 100 : null,
        },
      ],
    }));
  };

  const updateDraft = (
    sceneId: string,
    key: string,
    patch: Partial<DraftAction>,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [sceneId]: (prev[sceneId] ?? []).map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    }));
  };

  const removeDraft = (sceneId: string, key: string) => {
    setDrafts((prev) => ({
      ...prev,
      [sceneId]: (prev[sceneId] ?? []).filter((d) => d.key !== key),
    }));
  };

  const saveScene = async (sceneId: string) => {
    setSavingId(sceneId);
    setError(null);
    setSavedId(null);
    const sceneDrafts = drafts[sceneId] ?? [];
    const payload = sceneDrafts
      .filter((d) => d.device_id && d.entity_id)
      .map((d, index) => {
        const device = devices.find((dev) => dev.id === d.device_id);
        const data =
          d.service === "turn_on" &&
          deviceSupportsBrightness(device) &&
          typeof d.brightness_pct === "number"
            ? { brightness_pct: d.brightness_pct }
            : undefined;
        return {
          device_id: d.device_id,
          display_order: index,
          delay_seconds: 0,
          payload: {
            entity_id: d.entity_id,
            service: d.service,
            ...(data ? { data } : {}),
          },
        };
      });

    try {
      const response = await fetch(`/api/scenes/${sceneId}/actions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: payload }),
      });
      const body = (await response.json()) as {
        error?: string;
        actions?: SceneAction[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save scene");
      }
      const saved = body.actions ?? [];
      setActions((prev) => [
        ...prev.filter((a) => a.scene_id !== sceneId),
        ...saved,
      ]);
      setDrafts((prev) => ({
        ...prev,
        [sceneId]: draftsForScene(sceneId, saved, devices),
      }));
      setSavedId(sceneId);
      window.setTimeout(() => setSavedId(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scene");
    } finally {
      setSavingId(null);
    }
  };

  if (!hasProperty) return null;

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Scenes
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Attach real device actions. Tapping a scene tile on Home runs them
        from this device against Home Assistant.
      </p>

      {error && <p className="mt-3 text-sm text-amber-800">{error}</p>}

      {initialScenes.length === 0 ? (
        <p className="mt-5 text-sm text-stone-500">No scenes for this hive.</p>
      ) : (
        <div className="mt-5 space-y-5">
          {initialScenes.map((scene) => {
            const sceneDrafts = drafts[scene.id] ?? [];
            const others = otherActionsForScene(scene.id, actions);
            return (
              <div
                key={scene.id}
                className="rounded-[16px] border border-stone-100 bg-[#FAF8F3] p-4"
              >
                <h3 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-stone-900">
                  {scene.name}
                </h3>
                {scene.description ? (
                  <p className="mt-0.5 text-sm text-stone-500">
                    {scene.description}
                  </p>
                ) : null}

                {others.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {others.map((action) => (
                      <li
                        key={action.id}
                        className="text-xs font-medium uppercase tracking-wide text-stone-400"
                      >
                        {actionLabel(action)} — kept as-is
                      </li>
                    ))}
                  </ul>
                )}

                <ul className="mt-3 space-y-3">
                  {sceneDrafts.map((draft) => {
                    const device = devices.find((d) => d.id === draft.device_id);
                    const showBrightness =
                      draft.service === "turn_on" &&
                      deviceSupportsBrightness(device);
                    return (
                      <li
                        key={draft.key}
                        className="rounded-[12px] border border-stone-200 bg-white p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <label className="min-w-0 flex-1">
                            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                              Device
                            </span>
                            <select
                              value={draft.device_id}
                              onChange={(e) => {
                                const next = devices.find(
                                  (d) => d.id === e.target.value,
                                );
                                updateDraft(scene.id, draft.key, {
                                  device_id: e.target.value,
                                  entity_id: next?.external_id ?? "",
                                  brightness_pct: deviceSupportsBrightness(next)
                                    ? (draft.brightness_pct ?? 100)
                                    : null,
                                });
                              }}
                              className="min-h-[44px] w-full rounded-[10px] border border-stone-200 bg-[#FAF8F3] px-3 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none"
                            >
                              <option value="">Pick a device</option>
                              {activeDevices.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="sm:w-36">
                            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                              Action
                            </span>
                            <select
                              value={draft.service}
                              onChange={(e) =>
                                updateDraft(scene.id, draft.key, {
                                  service: e.target.value as
                                    | "turn_on"
                                    | "turn_off",
                                })
                              }
                              className="min-h-[44px] w-full rounded-[10px] border border-stone-200 bg-[#FAF8F3] px-3 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none"
                            >
                              <option value="turn_on">Turn on</option>
                              <option value="turn_off">Turn off</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeDraft(scene.id, draft.key)}
                            className="min-h-[44px] rounded-[10px] px-3 text-sm font-semibold text-stone-500 hover:text-stone-800"
                          >
                            Remove
                          </button>
                        </div>
                        {showBrightness && (
                          <label className="mt-3 block">
                            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                              Brightness {draft.brightness_pct ?? 100}%
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={draft.brightness_pct ?? 100}
                              onChange={(e) =>
                                updateDraft(scene.id, draft.key, {
                                  brightness_pct: Number(e.target.value),
                                })
                              }
                              className="w-full accent-[#F4B400]"
                            />
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={activeDevices.length === 0}
                    onClick={() => addAction(scene.id)}
                    className="inline-flex min-h-[44px] items-center rounded-[12px] border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-40"
                  >
                    Add device
                  </button>
                  <button
                    type="button"
                    disabled={savingId === scene.id}
                    onClick={() => void saveScene(scene.id)}
                    className="inline-flex min-h-[44px] items-center rounded-[12px] bg-[#F4B400] px-4 text-sm font-semibold text-stone-900 hover:bg-[#e0a800] disabled:opacity-50"
                  >
                    {savingId === scene.id
                      ? "Saving…"
                      : savedId === scene.id
                        ? "Saved"
                        : "Save actions"}
                  </button>
                </div>
                {activeDevices.length === 0 && (
                  <p className="mt-2 text-xs text-stone-400">
                    Sync devices first to attach them here.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
