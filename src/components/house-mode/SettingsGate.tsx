"use client";

import { useCallback, useEffect, useState } from "react";
import { PinPad } from "@/components/house-mode/PinPad";
import {
  isHouseModeDevice,
  isHouseModeUnlocked,
  setHouseModeDevice,
  setHouseModeUnlocked,
} from "@/lib/house-mode/settings";

type Props = {
  children: React.ReactNode;
};

export function SettingsGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isHouseModeDevice()) {
        if (!cancelled) {
          setNeedsPin(false);
          setReady(true);
        }
        return;
      }

      if (isHouseModeUnlocked()) {
        if (!cancelled) {
          setNeedsPin(false);
          setReady(true);
        }
        return;
      }

      // Owner may have cleared the property PIN — drop the device flag.
      try {
        const response = await fetch("/api/settings/house-mode", {
          cache: "no-store",
        });
        if (response.ok) {
          const body = (await response.json()) as { hasPin?: boolean };
          if (!body.hasPin) {
            setHouseModeDevice(false);
            if (!cancelled) {
              setNeedsPin(false);
              setReady(true);
            }
            return;
          }
        }
      } catch {
        // Keep gate if status check fails.
      }

      if (!cancelled) {
        setNeedsPin(true);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onComplete = useCallback(async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/house-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", pin }),
      });
      const body = (await response.json()) as {
        error?: string;
        hasPin?: boolean;
      };
      if (!response.ok) {
        setError(body.error ?? "Incorrect PIN");
        setResetToken((t) => t + 1);
        return;
      }
      if (body.hasPin === false) {
        setHouseModeDevice(false);
      }
      setHouseModeUnlocked(true);
      setNeedsPin(false);
    } catch {
      setError("Could not verify PIN");
      setResetToken((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[#F4B400]/25" />
      </div>
    );
  }

  if (needsPin) {
    return (
      <div className="px-2 py-10 sm:px-0">
        <p className="mb-2 text-center text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          House Mode
        </p>
        <PinPad
          title="Enter PIN"
          subtitle="This screen is locked. Enter the house PIN to open Settings."
          onComplete={onComplete}
          error={error}
          busy={busy}
          resetToken={resetToken}
        />
      </div>
    );
  }

  return <>{children}</>;
}
