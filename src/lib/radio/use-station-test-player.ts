"use client";

import { useCallback, useEffect, useState } from "react";

export type TestPlayerStatus = "idle" | "loading" | "playing" | "failed";

type State = {
  key: string | null;
  status: TestPlayerStatus;
};

type Listener = (state: State) => void;

const listeners = new Set<Listener>();
let audio: HTMLAudioElement | null = null;
let current: State = { key: null, status: "idle" };
let failTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: State) {
  current = next;
  for (const listener of listeners) listener(current);
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
  }
  return audio;
}

function clearFailTimer() {
  if (failTimer) {
    clearTimeout(failTimer);
    failTimer = null;
  }
}

function stopInternal() {
  clearFailTimer();
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  emit({ key: null, status: "idle" });
}

function bindAudio(el: HTMLAudioElement) {
  el.onplaying = () => {
    if (!current.key) return;
    clearFailTimer();
    emit({ key: current.key, status: "playing" });
  };
  el.onerror = () => {
    if (!current.key) return;
    clearFailTimer();
    const key = current.key;
    el.pause();
    emit({ key, status: "failed" });
  };
}

export function stopStationTest() {
  stopInternal();
}

export function playStationTest(key: string, url: string) {
  if (!url.trim()) {
    emit({ key, status: "failed" });
    return;
  }
  const el = getAudio();
  bindAudio(el);
  if (current.key && current.key !== key) {
    el.pause();
  }
  clearFailTimer();
  emit({ key, status: "loading" });
  el.src = url.trim();
  void el.play().catch(() => {
    if (current.key === key) emit({ key, status: "failed" });
  });
  failTimer = setTimeout(() => {
    if (current.key === key && current.status === "loading") {
      el.pause();
      emit({ key, status: "failed" });
    }
  }, 12000);
}

export function useStationTestPlayer(key: string) {
  const [state, setState] = useState<State>(current);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const isActive = state.key === key;
  const status: TestPlayerStatus = isActive ? state.status : "idle";

  const play = useCallback(
    (url: string) => {
      playStationTest(key, url);
    },
    [key],
  );

  const stop = useCallback(() => {
    if (current.key === key) stopInternal();
  }, [key]);

  return { status, isActive, play, stop };
}
