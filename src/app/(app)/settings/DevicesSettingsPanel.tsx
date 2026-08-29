"use client";

import { useMemo, useState } from "react";
import {
  fetchHomeAssistantClientConfig,
  haDeviceRegistryForEntities,
  haStates,
} from "@/lib/home-assistant/client";
import { statesToSyncItems } from "@/lib/home-assistant/sync";
import type { Device, Room } from "@/lib/types";

const DEVICES_CHANGED = "bumblehub:devices-changed";

function notifyDevicesChanged() {
  window.dispatchEvent(new CustomEvent(DEVICES_CHANGED));
}

type Props = {
  hasProperty: boolean;
  initialDevices: Device[];
  initialRooms: Room[];
};

export function DevicesSettingsPanel({
  hasProperty,
  initialDevices,
  initialRooms,
}: Props) {
  const [devices, setDevices] = useState(initialDevices);
  const [rooms, setRooms] = useState(initialRooms);
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...devices].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [devices],
  );

  const syncFromHomeAssistant = async () => {
    setSyncing(true);
    setError(null);
    setStatus(null);
    try {
      const config = await fetchHomeAssistantClientConfig({ force: true });
      if (!config.url || !config.token) {
        throw new Error(
          "Connect Home Assistant first — save a URL and long-lived access token above.",
        );
      }
      const [states, registry] = await Promise.all([
        haStates(config.url, config.token),
        haDeviceRegistryForEntities(config.url, config.token),
      ]);
      const items = statesToSyncItems(states, registry);
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices: items }),
      });
      const body = (await response.json()) as {
        error?: string;
        devices?: Device[];
        rooms?: Room[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save devices");
      }
      setDevices(body.devices ?? []);
      setRooms(body.rooms ?? rooms);
      notifyDevicesChanged();
      const active = (body.devices ?? []).filter((d) => d.is_active).length;
      setStatus(
        active === 0
          ? "No switch.* or light.* entities found."
          : `Synced ${active} device${active === 1 ? "" : "s"} from Home Assistant.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sync from Home Assistant",
      );
    } finally {
      setSyncing(false);
    }
  };

  const patchDevice = async (
    id: string,
    patch: { name?: string; room_id?: string | null },
  ) => {
    setSavingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/devices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json()) as {
        error?: string;
        device?: Device;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to update device");
      }
      if (body.device) {
        setDevices((prev) =>
          prev.map((d) => (d.id === id ? body.device! : d)),
        );
        notifyDevicesChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setSavingId(null);
    }
  };

  if (!hasProperty) {
    return null;
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Devices
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Pull switch and light entities from Home Assistant. Names and rooms
        stay as you set them on re-sync.
      </p>

      <button
        type="button"
        disabled={syncing}
        onClick={() => void syncFromHomeAssistant()}
        className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Sync devices from Home Assistant"}
      </button>

      {status && <p className="mt-3 text-sm text-emerald-800">{status}</p>}
      {error && <p className="mt-3 text-sm text-amber-800">{error}</p>}

      {sorted.length === 0 ? (
        <p className="mt-5 rounded-[14px] border border-dashed border-stone-200 bg-[#FAF8F3]/80 px-4 py-6 text-center text-sm text-stone-500">
          No devices yet. Connect Home Assistant above, then sync.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {sorted.map((device) => (
            <li
              key={device.id}
              className={`rounded-[16px] border border-stone-100 bg-[#FAF8F3] px-4 py-3 ${
                device.is_active ? "" : "opacity-55"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                    Friendly name
                  </span>
                  <input
                    type="text"
                    defaultValue={device.name}
                    disabled={savingId === device.id}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== device.name) {
                        void patchDevice(device.id, { name: next });
                      }
                    }}
                    className="min-h-[44px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                  />
                </label>
                <label className="sm:w-48">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                    Room
                  </span>
                  <select
                    value={device.room_id ?? ""}
                    disabled={savingId === device.id}
                    onChange={(e) => {
                      const value = e.target.value;
                      void patchDevice(device.id, {
                        room_id: value ? value : null,
                      });
                    }}
                    className="min-h-[44px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                  >
                    <option value="">Unassigned</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 font-mono text-xs text-stone-400">
                {device.external_id ?? "no entity id"}
                {device.device_type ? ` · ${device.device_type}` : ""}
                {!device.is_active ? " · inactive" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
