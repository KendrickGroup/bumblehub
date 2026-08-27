"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Radio } from "lucide-react";
import {
  useRadioStations,
  useTunedStationId,
  writeTunedStationId,
} from "@/lib/radio/use-radio-stations";
import { stopStationTest } from "@/lib/radio/use-station-test-player";
import type { RadioStation } from "@/lib/radio/types";

function needleT(count: number, index: number, parked: boolean): number {
  if (parked || count === 0) return 0.06;
  if (count === 1) return 0.5;
  return index / (count - 1);
}

export function RadioDial() {
  const { visible, loaded } = useRadioStations();
  const tunedId = useTunedStationId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const selected =
    visible.find((s) => s.id === tunedId) ??
    (loaded ? (visible[0] ?? null) : null);

  useEffect(() => {
    const el = new Audio();
    el.preload = "none";
    audioRef.current = el;
    const onPlaying = () => {
      setPlaying(true);
      setFailed(false);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setFailed(true);
    };
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);
    return () => {
      el.pause();
      el.removeAttribute("src");
      el.load();
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !tunedId) return;
    if (visible.some((s) => s.id === tunedId)) return;
    audioRef.current?.pause();
  }, [loaded, tunedId, visible]);

  const tuneTo = useCallback((station: RadioStation, autoplay: boolean) => {
    writeTunedStationId(station.id);
    setFailed(false);
    const el = audioRef.current;
    if (!el) return;
    const already = el.src === station.stream_url && !el.paused;
    if (already && autoplay) return;
    if (el.src !== station.stream_url) {
      el.src = station.stream_url;
    }
    if (autoplay) {
      stopStationTest();
      void el.play().catch(() => setFailed(true));
    }
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !selected) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    tuneTo(selected, true);
  }, [selected, tuneTo]);

  const parked = !loaded;
  const index = selected
    ? Math.max(0, visible.findIndex((s) => s.id === selected.id))
    : 0;
  const t = needleT(visible.length, index, parked);

  return (
    <section className="mx-auto w-full max-w-[720px]">
      <div
        className={`relative overflow-hidden rounded-[24px] border border-[#d9c7a0] bg-gradient-to-b from-[#f4ead4] to-[#e8d7b0] px-4 pt-5 pb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_32px_rgba(60,40,10,0.12)] transition-opacity duration-300 ${
          parked ? "pointer-events-none opacity-40" : "opacity-100"
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#7a5c28] uppercase">
            <Radio className="h-4 w-4" strokeWidth={2} />
            Dial
          </p>
          {selected && loaded ? (
            <p className="truncate text-right text-sm font-medium text-[#4a3a22]">
              {selected.city_label}
              <span className="text-[#9a7b42]"> · </span>
              {selected.station_name}
            </p>
          ) : (
            <p className="text-sm text-[#9a7b42]">
              {loaded ? "No stations" : "Tuning…"}
            </p>
          )}
        </div>

        <div className="h-[88px] sm:h-[104px]">
          <div className="relative mx-8 h-full sm:mx-10">
            <div
              className="absolute inset-x-0 top-7 h-[2px] bg-[#c4a66a] sm:top-8"
              aria-hidden
            />
            {visible.map((station, i) => {
              const pos =
                visible.length === 1 ? 0.5 : i / (visible.length - 1);
              const active = station.id === selected?.id && !parked;
              return (
                <button
                  key={station.id}
                  type="button"
                  disabled={parked}
                  onClick={() => tuneTo(station, true)}
                  className="absolute top-0 flex w-[4.5rem] -translate-x-1/2 flex-col items-center"
                  style={{ left: `${pos * 100}%` }}
                  aria-label={`${station.city_label} ${station.station_name}`}
                  aria-pressed={active}
                >
                  <span
                    className={`max-w-[4.25rem] truncate text-[10px] font-semibold tracking-wide uppercase sm:text-[11px] ${
                      active ? "text-[#3e2a14]" : "text-[#8a6d3b]"
                    }`}
                  >
                    {station.city_label}
                  </span>
                  <span
                    className={`mt-5 h-3 w-[2px] rounded-full sm:mt-6 ${
                      active ? "bg-[#c45a1a]" : "bg-[#b08948]"
                    }`}
                  />
                </button>
              );
            })}

            <div
              className="pointer-events-none absolute top-8 z-10 h-14 w-[3px] -translate-x-1/2 rounded-full bg-[#c45a1a] shadow-[0_0_8px_rgba(196,90,26,0.55)] transition-[left] duration-500 ease-out sm:top-9 sm:h-16"
              style={{ left: `${t * 100}%` }}
              aria-hidden
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={parked || !selected}
            onClick={togglePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3e2a14] text-[#f4ead4] shadow-[0_4px_0_#2a1b0c] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40"
            aria-label={playing ? "Stop radio" : "Play station"}
          >
            {playing ? (
              <Pause className="h-6 w-6" strokeWidth={2.25} fill="currentColor" />
            ) : (
              <Play className="h-6 w-6" strokeWidth={2.25} fill="currentColor" />
            )}
          </button>
        </div>

        {failed && selected ? (
          <p className="mt-3 text-center text-xs font-medium text-[#9a3b2a]">
            Could not load {selected.station_name}. Try another station.
          </p>
        ) : null}

        {loaded && visible.length === 0 ? (
          <p className="mt-3 text-center text-sm text-[#7a5c28]">
            The dial is empty. Add stations in Settings → Radio.
          </p>
        ) : null}
      </div>
    </section>
  );
}
