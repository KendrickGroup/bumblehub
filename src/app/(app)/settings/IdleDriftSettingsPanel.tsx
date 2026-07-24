"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_IDLE_DRIFT_SETTINGS,
  IDLE_DRIFT_MINUTES,
  cacheIdleDriftSettings,
  type IdleDriftMinutes,
  type IdleDriftSettings,
} from "@/lib/idle/settings";

type Props = {
  initialSettings: IdleDriftSettings;
  hasProperty: boolean;
};

export function IdleDriftSettingsPanel({
  initialSettings,
  hasProperty,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cacheIdleDriftSettings(settings);
  }, [settings]);

  const persist = useCallback(async (next: IdleDriftSettings) => {
    setSaving(true);
    setError(null);
    setSettings(next);
    cacheIdleDriftSettings(next);
    try {
      const response = await fetch("/api/settings/idle-drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = (await response.json()) as {
        error?: string;
        settings?: IdleDriftSettings;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save");
      }
      if (body.settings) {
        setSettings(body.settings);
        cacheIdleDriftSettings(body.settings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, []);

  if (!hasProperty) {
    return (
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Set a default home to configure idle slideshow.
      </div>
    );
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Idle slideshow
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        When the house is quiet, drift into Photo Booth memories. Pick the
        slideshow style under Photo Booth below.
      </p>

      <label className="mt-5 flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-[16px] bg-[#FAF8F3] px-4">
        <span className="text-base font-medium text-stone-800">
          Drift into memories when idle
        </span>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={saving}
          onChange={(e) =>
            void persist({ ...settings, enabled: e.target.checked })
          }
          className="h-6 w-6 accent-[#F4B400]"
        />
      </label>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-stone-600">Idle delay</p>
        <div className="grid grid-cols-4 gap-2">
          {IDLE_DRIFT_MINUTES.map((minutes) => {
            const active = settings.minutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                disabled={saving || !settings.enabled}
                onClick={() =>
                  void persist({
                    ...settings,
                    minutes: minutes as IdleDriftMinutes,
                  })
                }
                className={`min-h-[48px] rounded-[14px] text-sm font-semibold transition disabled:opacity-40 ${
                  active
                    ? "bg-[#F4B400] text-stone-900"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-[#F4B400]/50"
                }`}
              >
                {minutes} min
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saving && (
        <p className="mt-3 text-xs text-stone-500">Saving…</p>
      )}
    </section>
  );
}

export { DEFAULT_IDLE_DRIFT_SETTINGS };
