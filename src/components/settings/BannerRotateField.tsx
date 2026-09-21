"use client";

import { useRef, useState } from "react";
import {
  BANNER_ROTATE_DEFAULT_SEC,
  BANNER_ROTATE_MAX_SEC,
  BANNER_ROTATE_MIN_SEC,
  isBannerRotateSeconds,
} from "@/lib/radio/banner";
import { notifyRadioStationsChanged } from "@/lib/radio/types";
import { SettingsRow } from "./SettingsRows";

type Props = {
  hasProperty: boolean;
  initialSeconds: number;
};

export function BannerRotateField({ hasProperty, initialSeconds }: Props) {
  const [value, setValue] = useState(String(initialSeconds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(initialSeconds);
  const pending = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = async (raw: string) => {
    if (!hasProperty) return;
    const n = Number(raw);
    if (!isBannerRotateSeconds(n)) {
      setError(`Use ${BANNER_ROTATE_MIN_SEC} to ${BANNER_ROTATE_MAX_SEC} seconds.`);
      return;
    }
    setError(null);
    if (n === saved) return;
    try {
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate", banner_rotate_seconds: n }),
      });
      const body = (await response.json()) as {
        banner_rotate_seconds?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not save.");
        return;
      }
      const next =
        typeof body.banner_rotate_seconds === "number"
          ? body.banner_rotate_seconds
          : n;
      setSaved(next);
      setValue(String(next));
      notifyRadioStationsChanged();
    } catch {
      setError("Could not save.");
    }
  };

  const schedule = (next: string) => {
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(pending.current);
    }, 400);
  };

  return (
    <>
      <SettingsRow
        title="Change every"
        hint="How long each shirt stays up"
      >
        <input
          type="number"
          min={BANNER_ROTATE_MIN_SEC}
          max={BANNER_ROTATE_MAX_SEC}
          inputMode="numeric"
          value={value}
          disabled={!hasProperty}
          aria-label="Seconds between banner changes"
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setValue(next);
            schedule(next);
          }}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            void persist(value);
          }}
          className="settings-num"
        />
        <span className="settings-unit">sec</span>
      </SettingsRow>
      {error ? (
        <p className="settings-hint settings-hint-error">{error}</p>
      ) : (
        <p className="settings-hint">
          {BANNER_ROTATE_MIN_SEC} to {BANNER_ROTATE_MAX_SEC} seconds. The photo
          and the copy change together. Unset falls back to{" "}
          {BANNER_ROTATE_DEFAULT_SEC}.
        </p>
      )}
    </>
  );
}
