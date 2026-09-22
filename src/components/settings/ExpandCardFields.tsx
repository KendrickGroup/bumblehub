"use client";

/**
 * The two controls for the product expand card. Both land on the live card on
 * both surfaces the next time it opens — the settings ride along with the
 * banner payload, so nothing needs rebuilding.
 */

import { useRef, useState } from "react";
import {
  BANNER_BUY_LABEL_DEFAULT,
  BANNER_BUY_LABEL_MAX,
  type BannerCardSettings,
} from "@/lib/radio/banner";
import { notifyRadioStationsChanged } from "@/lib/radio/types";
import { SettingsRow } from "./SettingsRows";

type Props = {
  hasProperty: boolean;
  initial: BannerCardSettings;
};

export function ExpandCardFields({ hasProperty, initial }: Props) {
  const [showPrice, setShowPrice] = useState(initial.showPrice);
  const [label, setLabel] = useState(initial.buyLabel);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(initial.buyLabel);

  const persist = async (patch: {
    show_price?: boolean;
    buy_label?: string;
  }) => {
    if (!hasProperty) return;
    try {
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "card", ...patch }),
      });
      const body = (await response.json()) as {
        banner_show_price?: boolean;
        banner_buy_label?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not save.");
        return;
      }
      setError(null);
      if (typeof body.banner_show_price === "boolean") {
        setShowPrice(body.banner_show_price);
      }
      if (typeof body.banner_buy_label === "string") {
        setLabel(body.banner_buy_label);
        pending.current = body.banner_buy_label;
      }
      notifyRadioStationsChanged();
    } catch {
      setError("Could not save.");
    }
  };

  const scheduleLabel = (next: string) => {
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist({ buy_label: pending.current });
    }, 500);
  };

  return (
    <>
      <SettingsRow
        title="Show price on the card"
        hint="Off leaves the pitch line where it is"
      >
        <input
          type="checkbox"
          checked={showPrice}
          disabled={!hasProperty}
          aria-label="Show price on the card"
          onChange={(event) => {
            const next = event.target.checked;
            setShowPrice(next);
            void persist({ show_price: next });
          }}
          className="h-[22px] w-[22px] accent-[#F4B400]"
        />
      </SettingsRow>
      <SettingsRow title="Buy button label" hint="Blank falls back to Buy Now">
        <input
          type="text"
          value={label}
          maxLength={BANNER_BUY_LABEL_MAX}
          disabled={!hasProperty}
          placeholder={BANNER_BUY_LABEL_DEFAULT}
          aria-label="Buy button label"
          onChange={(event) => {
            const next = event.currentTarget.value;
            setLabel(next);
            scheduleLabel(next);
          }}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            void persist({ buy_label: label });
          }}
          className="settings-label-input"
        />
      </SettingsRow>
      {error ? (
        <p className="settings-hint settings-hint-error">{error}</p>
      ) : (
        <p className="settings-hint">
          Up to {BANNER_BUY_LABEL_MAX} characters, shown in caps on the button.
        </p>
      )}
    </>
  );
}
