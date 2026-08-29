"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MUSIC_UPDATED_EVENT } from "@/lib/music/events";
import {
  shouldYieldRadioToSpotify,
  showSpotifyTakeoverToast,
} from "@/lib/music/source-exclusive";
import type { NowPlayingResponse, PlaybackCommand } from "@/lib/music/types";
import {
  radioIsLive,
  stopRadioForSpotifyPlayback,
} from "@/lib/radio/use-radio-player";

const POLL_MS = 5000;
const REFRESH_AFTER_COMMAND_MS = 350;

type Listener = (state: NowPlayingResponse | null) => void;

let cached: NowPlayingResponse | null = null;
const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

function emit(next: NowPlayingResponse | null) {
  cached = next;
  for (const listener of listeners) {
    listener(next);
  }
}

function commandStartsSpotify(cmd: PlaybackCommand) {
  return (
    cmd.command === "play" ||
    cmd.command === "next" ||
    cmd.command === "previous"
  );
}

async function fetchNowPlaying(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const startedAt = Date.now();
    try {
      const response = await fetch("/api/music/now-playing", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as NowPlayingResponse;
      emit(body);
      if (
        shouldYieldRadioToSpotify(body, startedAt, radioIsLive())
      ) {
        stopRadioForSpotifyPlayback();
        showSpotifyTakeoverToast();
      }
    } catch {
      // Keep last known state on transient errors.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function startPolling() {
  if (pollTimer) return;
  void fetchNowPlaying();
  pollTimer = setInterval(() => {
    void fetchNowPlaying();
  }, POLL_MS);
}

function stopPollingIfIdle() {
  if (listeners.size > 0 || !pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  listener(cached);
  startPolling();
  return () => {
    listeners.delete(listener);
    stopPollingIfIdle();
  };
}

export function useNowPlaying() {
  const [state, setState] = useState<NowPlayingResponse | null>(cached);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [localVolume, setLocalVolume] = useState(50);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const reload = useCallback(() => fetchNowPlaying(), []);

  useEffect(() => {
    const unsubscribe = subscribe(setState);
    const onMusicUpdated = () => {
      void fetchNowPlaying();
      window.setTimeout(() => void fetchNowPlaying(), REFRESH_AFTER_COMMAND_MS);
    };
    window.addEventListener(MUSIC_UPDATED_EVENT, onMusicUpdated);
    return () => {
      unsubscribe();
      window.removeEventListener(MUSIC_UPDATED_EVENT, onMusicUpdated);
      if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state?.status === "idle" || state?.status === "playing") {
      if (state.volume != null) {
        setLocalVolume(state.volume);
      }
    }
  }, [state]);

  const sendCommand = useCallback(
    async (cmd: PlaybackCommand) => {
      if (commandStartsSpotify(cmd)) {
        stopRadioForSpotifyPlayback();
      }
      setBusy(true);
      try {
        const response = await fetch("/api/music/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cmd),
        });

        if (!response.ok) {
          let code: string | undefined;
          let errorMessage: string | undefined;
          try {
            const errBody = (await response.json()) as {
              code?: string;
              error?: string;
            };
            code = errBody.code;
            errorMessage = errBody.error;
          } catch {
            // ignore parse errors
          }

          if (code === "NO_ACTIVE_DEVICE" || response.status === 404) {
            showToast("Open Spotify on a device to start playback.");
          } else if (errorMessage) {
            showToast(errorMessage);
          }
          return;
        }

        await fetchNowPlaying();
        window.setTimeout(() => void fetchNowPlaying(), REFRESH_AFTER_COMMAND_MS);
      } finally {
        setBusy(false);
      }
    },
    [showToast],
  );

  const setVolume = useCallback(
    (volume: number) => {
      setLocalVolume(volume);
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      volumeDebounceRef.current = setTimeout(() => {
        void sendCommand({ command: "setVolume", volume });
      }, 350);
    },
    [sendCommand],
  );

  return {
    state,
    busy,
    toast,
    localVolume,
    setVolume,
    sendCommand,
    reload,
  };
}
