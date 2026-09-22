"use client";

import { useEffect, useState } from "react";
import { Airplay, Volume2, VolumeX } from "lucide-react";
import {
  canShowAirPlayPicker,
  hydrateRadioVolume,
  useRadioVolume,
} from "@/lib/radio/radio-volume";
import {
  setRadioVolume,
  showRadioAirPlayPicker,
  toggleRadioMute,
} from "@/lib/radio/use-radio-player";

export function RadioVolumeControl() {
  const { level, muted, output } = useRadioVolume();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateRadioVolume();
    setMounted(true);
  }, []);

  const showSlider = output !== "none";
  const showAirPlay = mounted && output === "none" && canShowAirPlayPicker();
  const pct = muted ? 0 : Math.round(level * 100);

  return (
    <div className="radio-vol">
      <button
        type="button"
        className={`radio-vol-mute ${muted ? "is-muted" : ""}`}
        aria-label={muted ? "Unmute radio" : "Mute radio"}
        aria-pressed={muted}
        onClick={() => toggleRadioMute()}
      >
        {muted ? (
          <VolumeX size={16} strokeWidth={2.25} aria-hidden />
        ) : (
          <Volume2 size={16} strokeWidth={2.25} aria-hidden />
        )}
      </button>
      {showSlider ? (
        <div className="radio-vol-track">
          <span className="radio-vol-rail" aria-hidden />
          <span
            className="radio-vol-fill"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
          <input
            type="range"
            className="radio-vol-range"
            min={0}
            max={100}
            step={1}
            value={pct}
            aria-label="Volume"
            onChange={(event) => {
              setRadioVolume(Number(event.target.value) / 100);
            }}
          />
        </div>
      ) : showAirPlay ? (
        <button
          type="button"
          className="radio-vol-airplay"
          aria-label="AirPlay"
          onClick={() => showRadioAirPlayPicker()}
        >
          <Airplay size={15} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
