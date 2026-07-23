"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { WeatherBucket } from "@/lib/weather/codes";
import { WeatherIcon } from "@/components/weather/WeatherIcons";

const REFRESH_MS = 15 * 60 * 1000;

type WeatherOk = {
  status: "ok";
  temperature: number;
  bucket: WeatherBucket;
  label: string;
  isDay: boolean;
  unitSymbol: string;
  locationLabel: string | null;
};

type WeatherState =
  | { status: "loading" }
  | { status: "no_location" }
  | { status: "error"; message: string }
  | WeatherOk;

export function WeatherChip() {
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/weather", { cache: "no-store" });
      const body = (await response.json()) as WeatherState & {
        error?: string;
        status?: string;
      };
      if (!response.ok) {
        setWeather({
          status: "error",
          message: body.error ?? "Could not load weather",
        });
        return;
      }
      if (body.status === "ok") {
        setWeather(body as WeatherOk);
        return;
      }
      if (
        body.status === "no_location" ||
        body.status === "no_property"
      ) {
        setWeather({ status: "no_location" });
        return;
      }
      setWeather({
        status: "error",
        message: body.error ?? "Could not load weather",
      });
    } catch {
      setWeather({ status: "error", message: "Could not load weather" });
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [settingsOpen]);

  const saveLocation = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setSettingsError(null);
    try {
      const response = await fetch("/api/weather/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        error?: string;
        weather?: WeatherOk;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save location");
      }
      if (body.weather?.status === "ok") {
        setWeather(body.weather);
      } else {
        await load();
      }
      setSettingsOpen(false);
      setZip("");
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to save location",
      );
    } finally {
      setSaving(false);
    }
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setSettingsError("Geolocation is not supported in this browser.");
      return;
    }
    setSaving(true);
    setSettingsError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void saveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          displayName: "Current location",
        });
      },
      () => {
        setSettingsError(
          "Could not get your location. Check browser permissions.",
        );
        setSaving(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  };

  const submitZip = (event: React.FormEvent) => {
    event.preventDefault();
    void saveLocation({ zip: zip.trim() });
  };

  return (
    <div className="relative group">
      <div className="relative flex min-h-[60px] min-w-[148px] items-center gap-3 rounded-[20px] bg-white px-5 py-4 shadow-sm">
        {weather.status === "loading" && (
          <>
            <div className="h-10 w-10 animate-pulse rounded-xl bg-stone-100" />
            <div>
              <div className="h-5 w-14 animate-pulse rounded bg-stone-100" />
              <div className="mt-1.5 h-4 w-16 animate-pulse rounded bg-stone-100" />
            </div>
          </>
        )}

        {weather.status === "no_location" && (
          <>
            <WeatherIcon
              bucket="partly_cloudy"
              isDay
              className="h-10 w-10 opacity-40"
            />
            <div>
              <p className="text-base font-semibold text-stone-700">
                Set location
              </p>
              <p className="text-sm text-stone-400">Tap ⚙ to configure</p>
            </div>
          </>
        )}

        {weather.status === "error" && (
          <>
            <WeatherIcon
              bucket="cloudy"
              isDay
              className="h-10 w-10 opacity-50"
            />
            <div>
              <p className="text-base font-semibold text-stone-700">
                Unavailable
              </p>
              <p className="text-sm text-stone-400">Try again later</p>
            </div>
          </>
        )}

        {weather.status === "ok" && (
          <>
            <WeatherIcon
              bucket={weather.bucket}
              isDay={weather.isDay}
              className="h-10 w-10 shrink-0"
            />
            <div>
              <p className="text-lg font-semibold tabular-nums text-stone-900">
                {weather.temperature}°{weather.unitSymbol}
              </p>
              <p className="text-sm text-stone-500">{weather.label}</p>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 opacity-35 transition hover:bg-stone-100 hover:text-stone-700 hover:opacity-100 group-hover:opacity-80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]/40"
          aria-label="Weather location settings"
        >
          <Settings className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {settingsOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 z-40 mt-2 w-[min(100vw-3rem,300px)] rounded-[18px] border border-stone-200/80 bg-white p-4 shadow-lg"
        >
          <p className="text-sm font-semibold text-stone-900">
            Weather location
          </p>
          {weather.status === "ok" && weather.locationLabel && (
            <p className="mt-1 text-xs text-stone-500">
              Currently: {weather.locationLabel}
            </p>
          )}
          <p className="mt-1 text-xs text-stone-500">
            Saved to your active Hive.
          </p>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              disabled={saving}
              onClick={useDeviceLocation}
              className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 py-2.5 text-left text-sm font-medium text-stone-800 transition hover:border-[#F4B400]/50 disabled:opacity-50"
            >
              Use this device&apos;s location
            </button>

            <form onSubmit={submitZip} className="space-y-2">
              <label
                htmlFor="weather-zip"
                className="block text-xs font-medium text-stone-600"
              >
                Or enter a US ZIP code
              </label>
              <input
                id="weather-zip"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                placeholder="90210"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="min-h-[48px] w-full rounded-[14px] border border-stone-200 px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
              />
              <button
                type="submit"
                disabled={saving || !zip.trim()}
                className="min-h-[48px] w-full rounded-[14px] bg-[#F4B400] text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
          </div>

          {settingsError && (
            <p className="mt-3 text-xs text-red-600">{settingsError}</p>
          )}
        </div>
      )}
    </div>
  );
}
