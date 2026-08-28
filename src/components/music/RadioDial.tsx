"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Play, Square } from "lucide-react";
import { formatTunedPlace } from "@/lib/radio/format-place";
import { stationFace } from "@/lib/radio/parse-identity";
import {
  playStaticCrackle,
  unlockStaticCrackle,
} from "@/lib/radio/static-crackle";
import type { RadioStation } from "@/lib/radio/types";
import { useRadioNowPlaying } from "@/lib/radio/use-radio-now-playing";
import {
  getRadioPlayerState,
  playRadio,
  radioIsLive,
  rememberTunedStation,
  setRadioVolume,
  stopRadioPlayback,
  useRadioPlayer,
} from "@/lib/radio/use-radio-player";
import {
  useRadioStations,
  useTunedStationId,
} from "@/lib/radio/use-radio-stations";
import { NowSpinningPanel } from "./NowSpinningPanel";

const NEEDLE_EASE = "left 550ms cubic-bezier(0.4, 0.1, 0.2, 1)";
const VOLUME_STEPS = [0.2, 0.4, 0.6, 0.8, 1] as const;
const SCALE_NUMS = ["54", "65", "80", "95", "110", "130", "160"];

function needleLeft(count: number, index: number, parked: boolean): string {
  if (parked || count === 0) return "8%";
  if (count === 1) return "50%";
  const t = index / (count - 1);
  return `${8 + t * 86}%`;
}

function volumeRotation(volume: number): number {
  return -135 + Math.min(1, Math.max(0, volume)) * 270;
}

export function RadioDial() {
  const { visible, loaded } = useRadioStations();
  const tunedId = useTunedStationId();
  const player = useRadioPlayer();
  const [crackle, setCrackle] = useState(false);

  const selected =
    visible.find((s) => s.id === tunedId) ??
    (loaded ? (visible[0] ?? null) : null);

  const playing = player.status === "playing";
  const buffering = player.status === "buffering";
  const reconnecting = player.reconnectAttempt > 0;
  const failed = player.status === "failed" && player.stationId === selected?.id;
  const live = playing || buffering;
  const tunedStillOnDial =
    !tunedId || visible.some((station) => station.id === tunedId);
  const face = selected ? stationFace(selected) : null;
  const song = useRadioNowPlaying(selected?.stream_url ?? null, playing);

  useEffect(() => {
    if (!loaded || tunedStillOnDial) return;
    stopRadioPlayback();
  }, [loaded, tunedStillOnDial]);

  const retuneFx = useCallback(() => {
    setCrackle(false);
    window.requestAnimationFrame(() => setCrackle(true));
  }, []);

  const onPreset = (station: RadioStation) => {
    const switching = getRadioPlayerState().stationId !== station.id;
    if (radioIsLive()) {
      playRadio(station);
    } else {
      rememberTunedStation(station);
    }
    unlockStaticCrackle();
    if (switching) {
      retuneFx();
      playStaticCrackle();
    }
  };

  const onPlayToggle = () => {
    if (radioIsLive()) {
      stopRadioPlayback();
      return;
    }
    if (!selected) return;
    playRadio(selected);
    unlockStaticCrackle();
    retuneFx();
    playStaticCrackle();
  };

  const cycleVolume = () => {
    const prev = getRadioPlayerState().volume;
    const i = VOLUME_STEPS.findIndex((step) => Math.abs(step - prev) < 0.05);
    const next = VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length]!;
    setRadioVolume(next);
  };

  const parked = !loaded;
  const index = selected
    ? Math.max(0, visible.findIndex((s) => s.id === selected.id))
    : 0;

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <div
        className={`radio-cabinet relative rounded-[24px] border border-[#33241A] px-[14px] pt-6 pb-6 sm:px-[26px] ${
          parked ? "pointer-events-none opacity-40" : "opacity-100"
        }`}
      >
        <div className="radio-cabinet-grain pointer-events-none absolute inset-0 rounded-[24px]" aria-hidden />

        <div className="relative mb-3.5 text-center">
          <p className="font-[family-name:var(--font-rye)] text-[18px] tracking-[0.12em] text-[#C9A24B] sm:text-[20px] [text-shadow:0_1px_0_rgba(0,0,0,.55)]">
            RANCH HOUSE RADIO
          </p>
          <p className="mt-[3px] text-[9px] font-semibold tracking-[0.28em] text-[#C9B896] uppercase">
            Latigo Ranch House · All-American Country
          </p>
        </div>

        <div className="radio-glass relative overflow-hidden rounded-[14px] px-4 pt-[18px] pb-4 sm:px-5">
          <span className="absolute top-2.5 left-4 text-[10px] font-extrabold tracking-[0.2em] text-[#8A6F45]">
            AM · FM
          </span>
          <div
            className={`absolute top-2 right-4 flex items-center gap-1.5 text-[9px] font-extrabold tracking-[0.2em] ${
              playing ? "text-[#8A6F45]" : "text-[#8A6F45]/45"
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={
                playing
                  ? {
                      background:
                        "radial-gradient(circle at 35% 30%, #FFE9A8, #F4B400 55%, #B8860B)",
                      boxShadow: "0 0 10px 3px rgba(244,180,0,.75)",
                      animation: "radio-onair-glow 1.6s infinite",
                    }
                  : {
                      background: "#9A8A68",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,.35)",
                    }
              }
              aria-hidden
            />
            ON AIR
          </div>

          <div className="mt-2.5 mb-3.5 min-h-[88px] text-center sm:min-h-[96px]">
            {failed && selected ? (
              <p className="pt-6 font-[family-name:var(--font-elite)] text-[13px] text-[#B3402A]">
                Could not load {selected.station_name}. Try another station.
              </p>
            ) : selected && loaded && face ? (
              <>
                <p className="font-[family-name:var(--font-rye)] text-[34px] leading-none tracking-[0.02em] text-[#241A12] sm:text-[44px]">
                  {face.readoutPrimary}
                  {face.readoutFreq ? (
                    <>
                      {" "}
                      <span className="text-[#B3402A]">{face.readoutFreq}</span>
                    </>
                  ) : null}
                </p>
                <p className="mt-1.5 font-[family-name:var(--font-elite)] text-[14px] text-[#6B5636]">
                  {formatTunedPlace(selected.city_label)}
                </p>
                {reconnecting ? (
                  <p className="mt-1 text-[10px] font-semibold tracking-[0.16em] text-[#8A6F45] uppercase">
                    reconnecting…
                  </p>
                ) : null}
              </>
            ) : loaded ? (
              <p className="pt-6 font-[family-name:var(--font-elite)] text-[#8A6F45]">
                The dial is empty.
              </p>
            ) : (
              <p className="pt-6 font-[family-name:var(--font-elite)] text-[#8A6F45]">
                Tuning…
              </p>
            )}
          </div>

          <div className="relative mx-1.5 h-[34px]">
            <div className="flex justify-between px-0.5 text-[10px] font-bold tracking-[0.08em] text-[#8A6F45]">
              {SCALE_NUMS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
            <div
              className="relative mt-[3px] h-3"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #C9B382 0 1px, transparent 1px 9px)",
                borderTop: "1px solid #B39F72",
                borderBottom: "1px solid #B39F72",
              }}
            >
              <div
                className="absolute top-[-8px] bottom-[-4px] w-1 rounded-sm"
                style={{
                  left: needleLeft(visible.length, index, parked),
                  transform: "translateX(-50%)",
                  background:
                    "linear-gradient(180deg,#E8C97E,#C9A24B 60%,#8A6B2F)",
                  boxShadow: "0 0 6px rgba(201,162,75,.7)",
                  transition: NEEDLE_EASE,
                }}
                aria-hidden
              />
            </div>
          </div>

          <div
            className={`pointer-events-none absolute inset-0 rounded-[14px] mix-blend-multiply ${
              crackle ? "radio-crackle" : "opacity-0"
            }`}
            style={{
              background:
                "repeating-conic-gradient(rgba(62,42,30,.12) 0 .6deg, transparent .6deg 1.2deg)",
            }}
            onAnimationEnd={() => setCrackle(false)}
            aria-hidden
          />
        </div>

        <div className="relative mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {visible.map((station) => {
            const preset = stationFace(station);
            const active = station.id === selected?.id && !parked;
            return (
              <button
                key={station.id}
                type="button"
                disabled={parked}
                onClick={() => onPreset(station)}
                aria-label={`${preset.buttonLabel} ${preset.buttonSub ?? station.city_label}`}
                aria-pressed={active}
                className={`radio-preset ${active ? "is-active" : ""}`}
              >
                <span className="radio-preset-call">{preset.buttonLabel}</span>
                {preset.buttonSub ? (
                  <span className="radio-preset-freq">{preset.buttonSub}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {visible.length === 0 && loaded ? (
          <p className="relative mt-4 text-center font-[family-name:var(--font-elite)] text-sm text-[#C9B896]">
            The dial is empty.
          </p>
        ) : null}

        <div className="relative mt-[18px] flex items-center justify-between px-1.5">
          <div className="flex w-[54px] flex-col items-center">
            <button
              type="button"
              disabled={parked}
              onClick={stopRadioPlayback}
              aria-label="Power, stop playback"
              className="radio-knob radio-knob-power"
            />
            <span className="mt-1.5 text-[9px] font-bold tracking-[0.2em] text-[#C9B896]">
              POWER
            </span>
          </div>

          <div
            className="radio-grille mx-2 h-10 min-w-3 flex-1 sm:mx-5 sm:h-[58px]"
            aria-hidden
          />

          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={parked || !selected}
              onClick={onPlayToggle}
              aria-label={live ? "Stop radio" : "Play radio"}
              aria-pressed={live}
              className={`radio-play-honey ${live ? "is-pressed" : ""}`}
            >
              {buffering && !reconnecting ? (
                <LoaderCircle
                  className="h-8 w-8 animate-spin text-[#3E2A1E]"
                  strokeWidth={2.25}
                />
              ) : live ? (
                <Square
                  className="h-7 w-7 text-[#3E2A1E]"
                  strokeWidth={2.25}
                  fill="currentColor"
                />
              ) : (
                <Play
                  className="ml-0.5 h-8 w-8 text-[#3E2A1E]"
                  strokeWidth={2.25}
                  fill="currentColor"
                />
              )}
            </button>
          </div>

          <div
            className="radio-grille mx-2 h-10 min-w-3 flex-1 sm:mx-5 sm:h-[58px]"
            aria-hidden
          />

          <div className="flex w-[54px] flex-col items-center">
            <button
              type="button"
              disabled={parked}
              onClick={cycleVolume}
              aria-label={`Volume ${Math.round(player.volume * 100)} percent`}
              className="radio-knob radio-knob-volume"
              style={{ transform: `rotate(${volumeRotation(player.volume)}deg)` }}
            />
            <span className="mt-1.5 text-[9px] font-bold tracking-[0.2em] text-[#C9B896]">
              VOLUME
            </span>
          </div>
        </div>

        {song && selected && playing ? (
          <NowSpinningPanel
            track={song}
            stationLine={`${face?.callSign || selected.station_name}${
              face?.frequency ? ` ${face.frequency}` : ""
            } · ${selected.city_label.toUpperCase()}`}
          />
        ) : null}
      </div>
    </section>
  );
}
