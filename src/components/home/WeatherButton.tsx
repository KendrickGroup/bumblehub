"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { WeatherBucket } from "@/lib/weather/codes";
import type { ForecastDay } from "@/lib/weather/forecast";
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
  daily: ForecastDay[];
};

type WeatherState =
  | { status: "loading" }
  | { status: "no_location" }
  | { status: "error"; message: string }
  | WeatherOk;

export function WeatherButton() {
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });
  const [open, setOpen] = useState(false);
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/weather", { cache: "no-store" });
      const body = (await response.json()) as {
        status?: string;
        error?: string;
        temperature?: number;
        bucket?: WeatherBucket;
        label?: string;
        isDay?: boolean;
        unitSymbol?: string;
        locationLabel?: string | null;
        daily?: ForecastDay[];
      };
      if (!response.ok) {
        setWeather({
          status: "error",
          message: body.error ?? "Could not load weather",
        });
        return;
      }
      if (
        body.status === "ok" &&
        typeof body.temperature === "number" &&
        body.bucket &&
        body.label &&
        typeof body.isDay === "boolean" &&
        body.unitSymbol
      ) {
        setWeather({
          status: "ok",
          temperature: body.temperature,
          bucket: body.bucket,
          label: body.label,
          isDay: body.isDay,
          unitSymbol: body.unitSymbol,
          locationLabel: body.locationLabel ?? null,
          daily: Array.isArray(body.daily) ? body.daily : [],
        });
        return;
      }
      if (body.status === "no_location" || body.status === "no_property") {
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
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const saveLocation = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setSettingsError(null);
    try {
      const response = await fetch("/api/weather/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save location");
      }
      await load();
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-w-[132px] rounded-xl border-none bg-white px-3 py-2 text-right shadow-[0_3px_10px_rgba(60,50,35,.08)] transition active:scale-[0.97]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {weather.status === "ok" ? (
          <>
            <div className="text-[16px] font-extrabold tabular-nums text-[#241A12]">
              {weather.temperature}°{weather.unitSymbol}
            </div>
            <div className="text-[10px] text-[#8A7F6E]">
              {weather.label}
              {weather.locationLabel ? ` · ${weather.locationLabel}` : ""}
            </div>
            <div className="mt-0.5 text-[9px] font-extrabold tracking-wide text-[#B8912E]">
              7-DAY ›
            </div>
          </>
        ) : weather.status === "no_location" ? (
          <>
            <div className="text-[16px] font-extrabold text-[#241A12]">Weather</div>
            <div className="text-[10px] text-[#8A7F6E]">Set location</div>
            <div className="mt-0.5 text-[9px] font-extrabold tracking-wide text-[#B8912E]">
              7-DAY ›
            </div>
          </>
        ) : weather.status === "error" ? (
          <>
            <div className="text-[16px] font-extrabold text-[#241A12]">—</div>
            <div className="text-[10px] text-[#8A7F6E]">Unavailable</div>
            <div className="mt-0.5 text-[9px] font-extrabold tracking-wide text-[#B8912E]">
              7-DAY ›
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto h-4 w-12 animate-pulse rounded bg-stone-100" />
            <div className="mx-auto mt-1.5 h-3 w-16 animate-pulse rounded bg-stone-100" />
          </>
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 border-0 bg-[rgba(30,20,12,0.45)]"
            aria-label="Close forecast"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-[420px] rounded-[20px] bg-[#FAF8F3] p-5 shadow-[0_18px_40px_rgba(30,20,12,0.35)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id={titleId}
                  className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#241A12]"
                  style={{ fontVariationSettings: '"opsz" 72' }}
                >
                  7-day forecast
                </h2>
                <p className="mt-1 text-sm text-[#8A7F6E]">
                  {weather.status === "ok"
                    ? weather.locationLabel ?? "At the cabin"
                    : "Weather at the cabin"}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0EDE6] text-[#241A12]"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {weather.status === "ok" && weather.daily.length > 0 ? (
              <ul className="mt-4 divide-y divide-[#E8E0D0]">
                {weather.daily.map((day) => (
                  <li
                    key={day.date}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span className="w-14 shrink-0 text-sm font-extrabold text-[#241A12]">
                      {day.weekday}
                    </span>
                    <WeatherIcon
                      bucket={day.bucket}
                      isDay
                      className="h-8 w-8 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-[#8A7F6E]">
                      {day.label}
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#241A12]">
                      {day.high}°/{day.low}°
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs font-semibold text-[#B8912E]">
                      {day.precipProb != null ? `${day.precipProb}%` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : weather.status === "ok" ? (
              <p className="mt-6 text-sm text-[#8A7F6E]">
                Forecast isn&apos;t available right now.
              </p>
            ) : weather.status === "no_location" ? (
              <p className="mt-6 text-sm text-[#8A7F6E]">
                Set a location to see the week ahead.
              </p>
            ) : (
              <p className="mt-6 text-sm text-[#8A7F6E]">
                Couldn&apos;t load the forecast. Try again in a bit.
              </p>
            )}

            <div className="mt-5 rounded-[16px] bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#A08A5F]">
                Location
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={useDeviceLocation}
                className="mt-3 min-h-[44px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-left text-sm font-medium text-stone-800 disabled:opacity-50"
              >
                Use this device&apos;s location
              </button>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveLocation({ zip: zip.trim() });
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  placeholder="ZIP"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="min-h-[44px] min-w-0 flex-1 rounded-[14px] border border-stone-200 px-3 text-base focus:border-[#F4B400] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={saving || !zip.trim()}
                  className="min-h-[44px] rounded-[14px] bg-[#F4B400] px-4 text-sm font-semibold text-stone-900 disabled:opacity-50"
                >
                  Save
                </button>
              </form>
              {settingsError ? (
                <p className="mt-2 text-xs text-red-600">{settingsError}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
