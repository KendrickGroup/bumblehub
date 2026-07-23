"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines } from "lucide-react";
import { DEFAULT_MUSIC_EQ_VISIBLE } from "@/lib/music/eq-settings";

const BAR_COUNT = 20;
const SEGMENT_COUNT = 12;
const PEAK_HOLD_MS = 400;
const COLLAPSE_MS = 600;
const TRACK_RESET_MS = 280;
const HIDE_MS = 300;
const EQ_HEIGHT_PX = 76;

/** Bottom→top LED colors: honey → amber → peak red. */
const SEGMENT_COLORS = [
  "#F4B400",
  "#F4B400",
  "#F4B400",
  "#F0AE18",
  "#EBA620",
  "#E0972B",
  "#E0972B",
  "#DC7E28",
  "#D96A29",
  "#D64B2A",
  "#D64B2A",
  "#D64B2A",
] as const;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** BPM in 90–120, stable per track id (Spotify tempo not available). */
function bpmFromTrackId(trackId: string): number {
  return 90 + (hashString(trackId) % 31);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

type RetroEqualizerProps = {
  isPlaying: boolean;
  trackId: string;
};

export function RetroEqualizer({ isPlaying, trackId }: RetroEqualizerProps) {
  const [visible, setVisible] = useState(DEFAULT_MUSIC_EQ_VISIBLE);
  const [prefLoaded, setPrefLoaded] = useState(false);
  /** Stays true until hide animation finishes so max-height can animate. */
  const [mountedOpen, setMountedOpen] = useState(DEFAULT_MUSIC_EQ_VISIBLE);

  const segmentRefs = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: BAR_COUNT }, () =>
      Array.from({ length: SEGMENT_COUNT }, () => null),
    ),
  );
  const peakRefs = useRef<(HTMLDivElement | null)[]>(
    Array.from({ length: BAR_COUNT }, () => null),
  );

  const levelsRef = useRef(new Float32Array(BAR_COUNT));
  const peaksRef = useRef(new Float32Array(BAR_COUNT));
  const peakHoldUntilRef = useRef(new Float64Array(BAR_COUNT));
  const noiseRef = useRef(new Float32Array(BAR_COUNT));
  const noiseTargetRef = useRef(new Float32Array(BAR_COUNT));
  const energyRef = useRef(0);
  const trackResetUntilRef = useRef(0);
  const lastTrackIdRef = useRef(trackId);
  const lastFrameRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const tabVisibleRef = useRef(
    typeof document === "undefined"
      ? true
      : document.visibilityState === "visible",
  );
  const animatingRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const trackIdRef = useRef(trackId);

  isPlayingRef.current = isPlaying;
  trackIdRef.current = trackId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/settings/music-eq", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { visible?: boolean };
        if (cancelled || typeof body.visible !== "boolean") return;
        setVisible(body.visible);
        setMountedOpen(body.visible);
      } catch {
        // Keep default.
      } finally {
        if (!cancelled) setPrefLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefLoaded) return;
    if (visible) {
      setMountedOpen(true);
      return;
    }
    const timer = window.setTimeout(() => setMountedOpen(false), HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [visible, prefLoaded]);

  const persistVisible = useCallback(async (next: boolean) => {
    setVisible(next);
    try {
      await fetch("/api/settings/music-eq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: next }),
      });
    } catch {
      // Optimistic UI already applied.
    }
  }, []);

  const paintFrame = useCallback((now: number) => {
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000 || 0.016);
    lastFrameRef.current = now;

    if (lastTrackIdRef.current !== trackIdRef.current) {
      lastTrackIdRef.current = trackIdRef.current;
      trackResetUntilRef.current = now + TRACK_RESET_MS;
      for (let i = 0; i < BAR_COUNT; i++) {
        peaksRef.current[i] = 0;
        peakHoldUntilRef.current[i] = 0;
        levelsRef.current[i] = 0;
      }
    }

    const targetEnergy = isPlayingRef.current ? 1 : 0;
    const energyStep = dt / (COLLAPSE_MS / 1000);
    if (energyRef.current < targetEnergy) {
      energyRef.current = Math.min(1, energyRef.current + energyStep);
    } else if (energyRef.current > targetEnergy) {
      energyRef.current = Math.max(0, energyRef.current - energyStep);
    }

    const resetT =
      trackResetUntilRef.current > now
        ? (trackResetUntilRef.current - now) / TRACK_RESET_MS
        : 0;
    const energy = energyRef.current * (1 - resetT);

    const bpm = bpmFromTrackId(trackIdRef.current);
    const t = now / 1000;
    const wobble = 1 + 0.04 * Math.sin(t * 0.37);
    const pulse = Math.pow(
      0.55 + 0.45 * Math.sin(t * (bpm / 60) * Math.PI * 2 * wobble),
      2.2,
    );

    const seed = hashString(trackIdRef.current);
    const raw = new Float32Array(BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const n = i / (BAR_COUNT - 1);
      const centerBias = clamp01(1.15 - Math.abs(n - 0.5) * 1.7);
      const phase = ((seed >>> (i % 16)) & 0xff) / 255 + i * 0.37;

      if (Math.random() < dt * 2.4) {
        noiseTargetRef.current[i] = Math.random();
      }
      noiseRef.current[i] +=
        (noiseTargetRef.current[i]! - noiseRef.current[i]!) *
        Math.min(1, dt * 3);

      const wave1 = 0.5 + 0.5 * Math.sin(t * 2.15 + phase);
      const wave2 = 0.5 + 0.5 * Math.sin(t * 3.55 + phase * 1.4);
      const wave3 = 0.5 + 0.5 * Math.sin(t * 1.25 + i * 0.45);

      const idle = 0.08 + 0.04 * (i % 3 === 0 ? 1 : 0);
      const lively =
        0.22 * pulse * centerBias +
        0.32 * wave1 * centerBias +
        0.22 * wave2 +
        0.14 * wave3 +
        0.18 * noiseRef.current[i]! * centerBias;

      raw[i] = idle + energy * lively;
    }

    for (let i = 0; i < BAR_COUNT; i++) {
      const left = raw[i > 0 ? i - 1 : i]!;
      const mid = raw[i]!;
      const right = raw[i < BAR_COUNT - 1 ? i + 1 : i]!;
      const correlated = 0.18 * left + 0.64 * mid + 0.18 * right;
      const prev = levelsRef.current[i]!;
      levelsRef.current[i] = prev + (correlated - prev) * Math.min(1, dt * 10);
    }

    for (let i = 0; i < BAR_COUNT; i++) {
      const level = clamp01(levelsRef.current[i]!);
      const litCount = Math.round(level * SEGMENT_COUNT);

      if (level >= peaksRef.current[i]!) {
        peaksRef.current[i] = level;
        peakHoldUntilRef.current[i] = now + PEAK_HOLD_MS;
      } else if (now > peakHoldUntilRef.current[i]!) {
        peaksRef.current[i] = Math.max(level, peaksRef.current[i]! - dt * 0.85);
      }

      const peakSeg = Math.max(
        0,
        Math.min(
          SEGMENT_COUNT - 1,
          Math.round(peaksRef.current[i]! * (SEGMENT_COUNT - 1)),
        ),
      );

      const segs = segmentRefs.current[i];
      if (segs) {
        for (let s = 0; s < SEGMENT_COUNT; s++) {
          const el = segs[s];
          if (!el) continue;
          el.style.opacity = s < litCount ? "1" : "0.09";
        }
      }

      const peakEl = peakRefs.current[i];
      if (peakEl) {
        const showPeak =
          energy > 0.05 && peaksRef.current[i]! > level + 0.05;
        peakEl.style.opacity = showPeak ? "0.95" : "0";
        peakEl.style.bottom = `${(peakSeg / SEGMENT_COUNT) * 100}%`;
      }
    }
  }, []);

  const stopLoop = useCallback(() => {
    animatingRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (animatingRef.current) return;
    if (!tabVisibleRef.current) return;
    animatingRef.current = true;
    lastFrameRef.current = performance.now();

    const loop = (now: number) => {
      if (!animatingRef.current || !tabVisibleRef.current) {
        rafRef.current = null;
        return;
      }
      paintFrame(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [paintFrame]);

  useEffect(() => {
    const onVisibility = () => {
      tabVisibleRef.current = document.visibilityState === "visible";
      if (tabVisibleRef.current && mountedOpen && visible) {
        startLoop();
      } else {
        stopLoop();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mountedOpen, visible, startLoop, stopLoop]);

  useEffect(() => {
    if (mountedOpen && visible && tabVisibleRef.current) {
      startLoop();
    } else {
      stopLoop();
    }
    return () => stopLoop();
  }, [mountedOpen, visible, startLoop, stopLoop]);

  const open = visible && mountedOpen;

  return (
    <div className="group/eq relative w-full">
      <div
        className="overflow-hidden transition-[max-height,opacity,margin] ease-out"
        style={{
          maxHeight: open ? EQ_HEIGHT_PX : 0,
          opacity: open ? 1 : 0,
          marginTop: open ? 20 : 0,
          marginBottom: open ? 0 : 0,
          transitionDuration: `${HIDE_MS}ms`,
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        <div
          className="flex h-[76px] items-end justify-between gap-[3px] py-0 pr-10 pl-0.5 sm:gap-1"
          role="img"
          aria-label="Equalizer visualizer"
        >
          {Array.from({ length: BAR_COUNT }, (_, barIndex) => (
            <div
              key={barIndex}
              className="relative flex h-full min-w-0 flex-1 flex-col-reverse justify-start gap-[2px]"
            >
              {Array.from({ length: SEGMENT_COUNT }, (_, segIndex) => (
                <div
                  key={segIndex}
                  ref={(el) => {
                    segmentRefs.current[barIndex]![segIndex] = el;
                  }}
                  className="w-full flex-1 rounded-[2px]"
                  style={{
                    backgroundColor: SEGMENT_COLORS[segIndex],
                    opacity: 0.09,
                    willChange: "opacity",
                  }}
                />
              ))}
              <div
                ref={(el) => {
                  peakRefs.current[barIndex] = el;
                }}
                className="pointer-events-none absolute left-0 right-0 h-[calc((100%-22px)/12)] rounded-[2px] bg-[#D64B2A] opacity-0"
                style={{
                  bottom: 0,
                  willChange: "opacity, bottom",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void persistVisible(!visible)}
        className={`absolute z-10 flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]/40 ${
          open
            ? "top-5 right-0 opacity-35 group-hover/eq:opacity-80"
            : "top-1 right-0 opacity-55"
        }`}
        aria-label={visible ? "Hide equalizer" : "Show equalizer"}
        aria-pressed={visible}
      >
        <AudioLines className="h-4 w-4" strokeWidth={2} />
      </button>

      {!open ? <div className="h-10" aria-hidden /> : null}
    </div>
  );
}
