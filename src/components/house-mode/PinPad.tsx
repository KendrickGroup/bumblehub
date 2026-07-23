"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void | Promise<void>;
  onCancel?: () => void;
  error?: string | null;
  busy?: boolean;
  /** When true, clears digits after a failed attempt. */
  resetToken?: number;
};

export function PinPad({
  title,
  subtitle,
  onComplete,
  onCancel,
  error,
  busy = false,
  resetToken = 0,
}: Props) {
  const [digits, setDigits] = useState("");
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setDigits("");
  }, [resetToken]);

  useEffect(() => {
    if (!error) return;
    setShaking(true);
    setDigits("");
    const id = window.setTimeout(() => setShaking(false), 450);
    return () => window.clearTimeout(id);
  }, [error]);

  const press = (d: string) => {
    if (busy) return;
    setDigits((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        window.setTimeout(() => void onComplete(next), 60);
      }
      return next;
    });
  };

  const backspace = () => {
    if (busy) return;
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h2
        className="text-center font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900"
        style={{ fontVariationSettings: '"opsz" 72' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-center text-sm text-stone-500">{subtitle}</p>
      )}

      <div
        className={`mt-8 flex justify-center gap-3 ${shaking ? "pin-shake" : ""}`}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition ${
              i < digits.length
                ? "border-[#F4B400] bg-[#F4B400]"
                : "border-stone-300 bg-transparent"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 text-center text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map(
          (key) => {
            if (key === "") {
              return <span key="empty" />;
            }
            if (key === "back") {
              return (
                <button
                  key="back"
                  type="button"
                  disabled={busy}
                  onClick={backspace}
                  aria-label="Delete"
                  className="flex min-h-[64px] items-center justify-center rounded-[18px] bg-stone-100 text-stone-700 transition hover:bg-stone-200 disabled:opacity-50"
                >
                  <Delete className="h-6 w-6" strokeWidth={2} />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => press(key)}
                className="min-h-[64px] rounded-[18px] bg-[#FAF8F3] text-2xl font-semibold text-stone-900 transition hover:bg-[#F4B400]/25 active:bg-[#F4B400]/40 disabled:opacity-50"
              >
                {key}
              </button>
            );
          },
        )}
      </div>

      {onCancel && (
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="mt-6 min-h-[48px] w-full rounded-[16px] text-sm font-medium text-stone-500 transition hover:text-stone-800"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
