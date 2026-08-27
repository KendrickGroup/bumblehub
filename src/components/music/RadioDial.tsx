"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Play, Square } from "lucide-react";
import { formatTunedPlace } from "@/lib/radio/format-place";
import {
  playStaticCrackle,
  unlockStaticCrackle,
} from "@/lib/radio/static-crackle";
import type { RadioStation } from "@/lib/radio/types";
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

const NEEDLE_EASE = "left 550ms cubic-bezier(0.4, 0.1, 0.2, 1)";
const VOLUME_STEPS = [0.2, 0.4, 0.6, 0.8, 1] as const;

function needleLeft(count: number, index: number, parked: boolean): string {
  if (parked || count === 0) return "4%";
  if (count === 1) return "50%";
  const t = index / (count - 1);
  return `${4 + t * 92}%`;
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
  const failed = player.status === "failed" && player.stationId === selected?.id;
  const live = playing || buffering;
  const tunedStillOnDial =
    !tunedId || visible.some((station) => station.id === tunedId);

  useEffect(() => {
    if (!loaded || tunedStillOnDial) return;
    stopRadioPlayback();
  }, [loaded, tunedStillOnDial]);

  const retuneFx = useCallback(() => {
    setCrackle(false);
    window.requestAnimationFrame(() => setCrackle(true));
  }, []);

  const onCity = (station: RadioStation) => {
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
    <section className="mx-auto w-full max-w-[680px]">
      <div
        className={`relative rounded-[22px] border border-[#33241A] px-[18px] pt-[22px] pb-5 sm:px-7 sm:pt-[26px] sm:pb-6 ${
          parked ? "pointer-events-none opacity-40" : "opacity-100"
        }`}
        style={{
          background:
            "repeating-linear-gradient(90deg, #7A5B3E 0 3px, #3E2A1E 3px 5px, #5E4530 5px 40px, #4E3826 40px 42px, #6B4F36 42px 82px, #533C29 82px 84px)",
          boxShadow:
            "0 16px 40px rgba(44,29,20,.4), inset 0 2px 0 rgba(255,255,255,.12), inset 0 -4px 10px rgba(0,0,0,.35)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px]"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent 0 26px, rgba(30,20,12,.12) 26px 27px)",
          }}
          aria-hidden
        />

        <div className="relative mb-4 text-center">
          <p className="font-[family-name:var(--font-rye)] text-[17px] tracking-[0.14em] text-[#C9A24B] sm:text-[19px] sm:tracking-[0.12em] [text-shadow:0_1px_0_rgba(0,0,0,.55)]">
            RANCH HOUSE RADIO
          </p>
          <p className="mt-[3px] text-[9px] font-semibold tracking-[0.28em] text-[#C9B896] uppercase">
            Latigo Ranch House · All-American Country
          </p>
        </div>

        <div
          className="relative overflow-hidden rounded-[12px] px-3 pt-[26px] pb-4 sm:px-[18px] sm:pb-5"
          style={{
            background: "linear-gradient(180deg,#F7EFDA,#F3E9CF 55%,#E7D9B6)",
            boxShadow:
              "inset 0 2px 8px rgba(62,42,30,.35), inset 0 0 0 2px #C9B382, 0 2px 0 rgba(255,255,255,.15)",
          }}
        >
          <span className="absolute top-2 left-4 text-[10px] font-extrabold tracking-[0.2em] text-[#8A6F45]">
            AM
          </span>
          <div
            className={`absolute top-[7px] right-[14px] flex items-center gap-1.5 text-[9px] font-extrabold tracking-[0.2em] ${
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

          <div className="flex justify-between gap-0.5 overflow-x-auto px-1.5 pb-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visible.map((station) => {
              const active = station.id === selected?.id && !parked;
              return (
                <button
                  key={station.id}
                  type="button"
                  disabled={parked}
                  onClick={() => onCity(station)}
                  aria-label={`${station.city_label} ${station.station_name}`}
                  aria-pressed={active}
                  className={`min-w-0 shrink px-0.5 py-1.5 text-center leading-[1.25] transition-colors ${
                    active
                      ? "text-[#241A12]"
                      : "text-[#6B5636] hover:text-[#B3402A]"
                  }`}
                >
                  <span className="block truncate text-[9px] font-bold tracking-[0.14em] uppercase sm:text-[11px] sm:tracking-[0.16em]">
                    {station.city_label}
                  </span>
                  <span
                    className={`mt-0.5 block truncate font-[family-name:var(--font-elite)] text-[8px] tracking-[0.04em] normal-case sm:text-[8.5px] ${
                      active ? "text-[#B3402A]" : "text-[#A08A5F]"
                    }`}
                  >
                    {station.station_name}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="relative mx-1.5 h-3.5"
            style={{
              background:
                "repeating-linear-gradient(90deg, #C9B382 0 1px, transparent 1px 12px)",
              borderTop: "1px solid #B39F72",
              borderBottom: "1px solid #B39F72",
            }}
          >
            <div
              className="absolute top-[-24px] bottom-[-6px] w-1 rounded-sm"
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

          <div
            className={`pointer-events-none absolute inset-0 rounded-[12px] mix-blend-multiply ${
              crackle ? "radio-crackle" : "opacity-0"
            }`}
            style={{
              background:
                "repeating-conic-gradient(rgba(62,42,30,.12) 0 .6deg, transparent .6deg 1.2deg)",
            }}
            onAnimationEnd={() => setCrackle(false)}
            aria-hidden
          />

          <div className="mt-3.5 min-h-[22px] text-center font-[family-name:var(--font-elite)] text-[13px] leading-snug text-[#4A3A24] sm:text-[14px]">
            {failed && selected ? (
              <span className="text-[#B3402A]">
                Could not load {selected.station_name}. Try another station.
              </span>
            ) : selected && loaded ? (
              <>
                Tuned to{" "}
                <b className="font-normal text-[#B3402A]">
                  {selected.station_name}
                </b>
                {" — "}
                {formatTunedPlace(selected.city_label)}
              </>
            ) : loaded ? (
              <span className="text-[#8A6F45]">The dial is empty.</span>
            ) : (
              <span className="text-[#8A6F45]">Tuning…</span>
            )}
          </div>
        </div>

        <div className="relative mt-5 flex items-end justify-between px-1 sm:px-2">
          <div className="flex w-[58px] flex-col items-center">
            <button
              type="button"
              disabled={parked}
              onClick={stopRadioPlayback}
              aria-label="Power, stop playback"
              className="h-[58px] w-[58px] rounded-full border-2 border-[#2C1D12] disabled:opacity-40"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #D4674C, #B3402A 60%, #6E2517)",
                boxShadow:
                  "0 4px 8px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.2)",
              }}
            >
              <span
                className="mx-auto block h-4 w-1 rounded-sm bg-[#C9A24B]"
                style={{ marginTop: 6 }}
                aria-hidden
              />
            </button>
            <span className="mt-[7px] text-[9px] font-bold tracking-[0.2em] text-[#C9B896]">
              POWER
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center">
            <button
              type="button"
              disabled={parked || !selected}
              onClick={onPlayToggle}
              aria-label={live ? "Stop radio" : "Play radio"}
              aria-pressed={live}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full disabled:opacity-40 sm:h-[82px] sm:w-[82px]"
              style={{
                background:
                  "radial-gradient(circle at 35% 28%, #F7EFDA, #E7D9B6 55%, #C9B382)",
                border: "4px solid #C9A24B",
                boxShadow:
                  "0 5px 12px rgba(0,0,0,.45), inset 0 2px 4px rgba(255,255,255,.45), 0 0 0 2px #2C1D12",
              }}
            >
              {buffering ? (
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
                  className="ml-1 h-8 w-8 text-[#3E2A1E]"
                  strokeWidth={2.25}
                  fill="currentColor"
                />
              )}
            </button>
            <span className="mt-[7px] text-[9px] font-bold tracking-[0.2em] text-[#C9B896]">
              {live ? "STOP" : "PLAY"}
            </span>
          </div>

          <div className="flex w-[58px] flex-col items-center">
            <button
              type="button"
              disabled={parked}
              onClick={cycleVolume}
              aria-label={`Volume ${Math.round(player.volume * 100)} percent`}
              className="relative h-[58px] w-[58px] rounded-full border-2 border-[#2C1D12] disabled:opacity-40"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #8A6B4F, #3E2A1E 65%)",
                boxShadow:
                  "0 4px 8px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.2)",
                transform: `rotate(${volumeRotation(player.volume)}deg)`,
              }}
            >
              <span
                className="absolute top-1.5 left-1/2 h-4 w-1 -translate-x-1/2 rounded-sm bg-[#C9A24B]"
                aria-hidden
              />
            </button>
            <span className="mt-[7px] text-[9px] font-bold tracking-[0.2em] text-[#C9B896]">
              VOLUME
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
