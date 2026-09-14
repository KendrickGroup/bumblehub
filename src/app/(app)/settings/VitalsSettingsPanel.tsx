"use client";

import { useMemo, useState } from "react";
import type { Device } from "@/lib/types";
import {
  VITAL_SLOT_LABEL,
  VITAL_SLOTS,
  type VitalSlot,
  type VitalsConfig,
} from "@/lib/home/vitals";

type Props = {
  hasProperty: boolean;
  initialConfig: VitalsConfig;
  devices: Device[];
};

export function VitalsSettingsPanel({
  hasProperty,
  initialConfig,
  devices,
}: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const sensors = useMemo(
    () =>
      devices
        .filter((d) => d.device_type === "sensor" && d.is_active && d.external_id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  const persist = async (slot: VitalSlot, entityId: string | null) => {
    const next = { ...config, [slot]: entityId };
    setConfig(next);
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = (await response.json()) as {
        error?: string;
        config?: VitalsConfig;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save vitals");
      }
      if (body.config) setConfig(body.config);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vitals");
    } finally {
      setSaving(false);
    }
  };

  if (!hasProperty) return null;

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Vitals
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Map Home Assistant sensors to the home Vitals tile. Unmapped slots stay
        hidden. Sync devices first so sensors appear in the lists.
      </p>

      <div className="mt-5 space-y-4">
        {VITAL_SLOTS.map((slot) => (
          <label key={slot} className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
              {VITAL_SLOT_LABEL[slot]}
            </span>
            <select
              value={config[slot] ?? ""}
              disabled={saving}
              onChange={(e) => persist(slot, e.target.value || null)}
              className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-3 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none"
            >
              <option value="">Not mapped</option>
              {sensors.map((device) => (
                <option key={device.id} value={device.external_id ?? ""}>
                  {device.name}
                  {device.external_id ? ` · ${device.external_id}` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {sensors.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          No sensors synced yet. Use Devices → Sync from Home Assistant.
        </p>
      ) : null}
      {status ? <p className="mt-3 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-amber-800">{error}</p> : null}
    </section>
  );
}
