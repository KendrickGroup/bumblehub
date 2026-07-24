"use client";

import { useCallback, useState } from "react";
import {
  SLIDESHOW_STYLES,
  SLIDESHOW_STYLE_LABELS,
  type SlideshowStyle,
} from "@/lib/hive/slideshow-style";

type Props = {
  initialStyle: SlideshowStyle;
  /** Compact segmented control for /hive; default is settings-sized. */
  compact?: boolean;
};

export function SlideshowStyleSwitcher({
  initialStyle,
  compact = false,
}: Props) {
  const [style, setStyle] = useState(initialStyle);
  const [saving, setSaving] = useState(false);

  const persist = useCallback(async (next: SlideshowStyle) => {
    setStyle(next);
    setSaving(true);
    try {
      await fetch("/api/settings/slideshow-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: next }),
      });
    } catch {
      // Keep optimistic selection.
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <div className={compact ? "" : "mt-5"}>
      {!compact && (
        <>
          <p className="mb-2 text-sm font-medium text-stone-600">
            Slideshow style
          </p>
          <p className="mb-3 text-xs text-stone-500">
            Applies the next time a slideshow starts.
          </p>
        </>
      )}
      {compact && (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
          Slideshow style
        </p>
      )}
      <div
        className={`grid gap-2 ${
          compact
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        }`}
        role="group"
        aria-label="Slideshow style"
      >
        {SLIDESHOW_STYLES.map((option) => {
          const active = style === option;
          return (
            <button
              key={option}
              type="button"
              disabled={saving}
              onClick={() => void persist(option)}
              className={`rounded-[14px] text-sm font-semibold transition disabled:opacity-50 ${
                compact ? "min-h-[44px] px-2" : "min-h-[48px] px-3"
              } ${
                active
                  ? "bg-[#F4B400] text-stone-900"
                  : "border border-stone-200 bg-white text-stone-700 hover:border-[#F4B400]/50"
              }`}
            >
              {SLIDESHOW_STYLE_LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
