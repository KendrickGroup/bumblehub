"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.12;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.35);
    void ctx.close();
  } catch {
    // Optional audio.
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Props = {
  timerSeconds: number;
};

export function RecipeTimer({ timerSeconds }: Props) {
  const [remaining, setRemaining] = useState(timerSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    setRemaining(timerSeconds);
    setRunning(false);
    setDone(false);
    clearTimer();
  }, [timerSeconds, clearTimer]);

  useEffect(() => {
    if (!running || done) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setRunning(false);
          setDone(true);
          setPulse(true);
          playChime();
          window.setTimeout(() => setPulse(false), 1200);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, done, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const start = () => {
    if (done) {
      setRemaining(timerSeconds);
      setDone(false);
    }
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const addThirty = () => {
    setRemaining((r) => Math.min(r + 30, 99 * 60 + 59));
    if (done) setDone(false);
  };

  return (
    <div
      className={`mt-5 rounded-[18px] border border-stone-200 bg-[#FAF8F3] px-5 py-4 transition ${
        pulse ? "ring-2 ring-[#F4B400]/60" : ""
      }`}
    >
      <p className="text-sm font-medium text-stone-500">Timer</p>
      <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-stone-900">
        {formatTime(remaining)}
      </p>
      {done && (
        <p className="mt-2 text-base font-medium text-[#b8860b]">Timer done.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!running && !done && (
          <button
            type="button"
            onClick={start}
            className="min-h-[52px] rounded-[18px] bg-[#F4B400] px-6 text-base font-semibold text-stone-900 hover:bg-[#e0a800]"
          >
            Start
          </button>
        )}
        {running && (
          <>
            <button
              type="button"
              onClick={pause}
              className="min-h-[52px] rounded-[18px] border border-stone-200 bg-white px-5 text-base font-medium text-stone-800 hover:bg-stone-50"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={addThirty}
              className="min-h-[52px] rounded-[18px] border border-stone-200 bg-white px-5 text-base font-medium text-stone-800 hover:bg-stone-50"
            >
              +30s
            </button>
          </>
        )}
        {done && (
          <button
            type="button"
            onClick={() => {
              setRemaining(timerSeconds);
              setDone(false);
              setRunning(true);
            }}
            className="min-h-[52px] rounded-[18px] bg-[#F4B400] px-6 text-base font-semibold text-stone-900 hover:bg-[#e0a800]"
          >
            Start again
          </button>
        )}
        {!running && !done && remaining < timerSeconds && (
          <button
            type="button"
            onClick={start}
            className="min-h-[52px] rounded-[18px] border border-stone-200 bg-white px-5 text-base font-medium text-stone-800"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
