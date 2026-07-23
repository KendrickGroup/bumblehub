"use client";

import { useCallback, useEffect, useState } from "react";
import { PinPad } from "@/components/house-mode/PinPad";
import {
  isHouseModeDevice,
  setHouseModeDevice,
  setHouseModeUnlocked,
} from "@/lib/house-mode/settings";

type Status = {
  hasProperty: boolean;
  hasPin: boolean;
  greeting: string;
  propertyName: string | null;
  isOwner: boolean;
};

type Flow =
  | { kind: "idle" }
  | { kind: "enable-new"; step: "enter" | "confirm"; first: string }
  | { kind: "enable-existing" }
  | { kind: "disable" };

type Props = {
  initial: Status;
};

export function HouseModeSettingsPanel({ initial }: Props) {
  const [status, setStatus] = useState(initial);
  const [deviceOn, setDeviceOn] = useState(false);
  const [greeting, setGreeting] = useState(initial.greeting);
  const [flow, setFlow] = useState<Flow>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDeviceOn(isHouseModeDevice());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/house-mode", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as Status;
      setStatus(body);
      setGreeting(body.greeting);
      if (!body.hasPin && isHouseModeDevice()) {
        setHouseModeDevice(false);
        setDeviceOn(false);
      }
    } catch {
      // keep local
    }
  }, []);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/settings/house-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      error?: string;
      hasPin?: boolean;
      greeting?: string;
    };
    if (!response.ok) {
      throw new Error(body.error ?? "Request failed");
    }
    return body;
  }, []);

  const onToggle = () => {
    setError(null);
    setMessage(null);
    if (deviceOn) {
      setFlow({ kind: "disable" });
      return;
    }
    if (status.hasPin) {
      setFlow({ kind: "enable-existing" });
    } else {
      setFlow({ kind: "enable-new", step: "enter", first: "" });
    }
  };

  const finishEnable = async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "enable", pin });
      setHouseModeDevice(true);
      setHouseModeUnlocked(true);
      setDeviceOn(true);
      setFlow({ kind: "idle" });
      setMessage("This device is now a house screen.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable");
      setResetToken((t) => t + 1);
    } finally {
      setBusy(false);
    }
  };

  const onPinComplete = async (pin: string) => {
    if (flow.kind === "enable-new") {
      if (flow.step === "enter") {
        setFlow({ kind: "enable-new", step: "confirm", first: pin });
        setResetToken((t) => t + 1);
        return;
      }
      if (pin !== flow.first) {
        setError("PINs didn’t match. Try again.");
        setFlow({ kind: "enable-new", step: "enter", first: "" });
        setResetToken((t) => t + 1);
        return;
      }
      await finishEnable(pin);
      return;
    }

    if (flow.kind === "enable-existing") {
      await finishEnable(pin);
      return;
    }

    if (flow.kind === "disable") {
      setBusy(true);
      setError(null);
      try {
        await post({ action: "disable", pin });
        setHouseModeDevice(false);
        setDeviceOn(false);
        setFlow({ kind: "idle" });
        setMessage("House Mode turned off on this device.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Incorrect PIN");
        setResetToken((t) => t + 1);
      } finally {
        setBusy(false);
      }
    }
  };

  const saveGreeting = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = await post({
        action: "update_greeting",
        greeting,
      });
      if (typeof body.greeting === "string") setGreeting(body.greeting);
      setMessage("Greeting saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save greeting");
    } finally {
      setBusy(false);
    }
  };

  const ownerClear = async () => {
    if (
      !window.confirm(
        "Clear the house PIN for this hive? House screens will unlock until a new PIN is set.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post({ action: "owner_clear" });
      setHouseModeDevice(false);
      setDeviceOn(false);
      setMessage("House Mode PIN cleared for this hive.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear PIN");
    } finally {
      setBusy(false);
    }
  };

  if (!status.hasProperty) {
    return (
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Set a default home to configure House Mode.
      </div>
    );
  }

  if (flow.kind !== "idle") {
    const titles =
      flow.kind === "disable"
        ? {
            title: "Enter PIN to turn off",
            subtitle: "House Mode stays on until the PIN is confirmed.",
          }
        : flow.kind === "enable-existing"
          ? {
              title: "Enter house PIN",
              subtitle: "Use the same PIN as other house screens.",
            }
          : flow.step === "enter"
            ? {
                title: "Choose a 4-digit PIN",
                subtitle: "You’ll need this PIN to open Settings on this device.",
              }
            : {
                title: "Confirm PIN",
                subtitle: "Enter the same PIN again.",
              };

    return (
      <section className="rounded-[20px] bg-white p-6 shadow-sm">
        <PinPad
          title={titles.title}
          subtitle={titles.subtitle}
          onComplete={onPinComplete}
          onCancel={() => {
            setFlow({ kind: "idle" });
            setError(null);
          }}
          error={error}
          busy={busy}
          resetToken={resetToken}
        />
      </section>
    );
  }

  const previewName = status.propertyName ?? "your hive";

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        House Mode
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Turn this tablet into a shared house screen. Settings stay behind a PIN
        so guests can&apos;t sign out or change config.
      </p>

      <label className="mt-5 flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-[16px] bg-[#FAF8F3] px-4">
        <span className="text-base font-medium text-stone-800">
          This device is a house screen
        </span>
        <input
          type="checkbox"
          checked={deviceOn}
          disabled={busy}
          onChange={onToggle}
          className="h-6 w-6 accent-[#F4B400]"
        />
      </label>

      <div className="mt-6">
        <label
          htmlFor="house-greeting"
          className="mb-2 block text-sm font-medium text-stone-600"
        >
          House greeting
        </label>
        <p className="mb-2 text-xs text-stone-500">
          Shown on Home when House Mode is on. Leave blank for time-of-day
          defaults. Use {"{name}"} for the hive name (e.g. Welcome to {"{name}"}
          ).
        </p>
        <input
          id="house-greeting"
          type="text"
          maxLength={120}
          value={greeting}
          disabled={busy}
          placeholder={`Good morning at ${previewName}`}
          onChange={(e) => setGreeting(e.target.value)}
          className="min-h-[48px] w-full rounded-[14px] border border-stone-200 px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveGreeting()}
          className="mt-3 min-h-[48px] rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
        >
          Save greeting
        </button>
      </div>

      {status.isOwner && status.hasPin && (
        <div className="mt-6 rounded-[16px] border border-stone-200 bg-[#FAF8F3] px-4 py-4">
          <p className="text-sm font-medium text-stone-800">Forgot the PIN?</p>
          <p className="mt-1 text-xs text-stone-500">
            As the hive owner, you can clear House Mode from a non-house device
            (or after unlocking Settings).
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void ownerClear()}
            className="mt-3 min-h-[44px] rounded-[14px] border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            Clear house PIN
          </button>
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm font-medium text-stone-700">{message}</p>
      )}
      {error && flow.kind === "idle" && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </section>
  );
}
