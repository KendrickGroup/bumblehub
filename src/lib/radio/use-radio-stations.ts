"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  MAX_VISIBLE_STATIONS,
  RADIO_STATIONS_EVENT,
  RADIO_TUNED_ID_KEY,
  type RadioStation,
} from "@/lib/radio/types";

type Payload = {
  stations: RadioStation[];
  hasProperty: boolean;
};

export function useRadioStations(opts?: { all?: boolean }) {
  const all = opts?.all === true;
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasProperty, setHasProperty] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        all ? "/api/radio/stations?all=1" : "/api/radio/stations",
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const body = (await response.json()) as Payload;
      setStations(body.stations ?? []);
      setHasProperty(body.hasProperty !== false);
    } catch {
      // Keep last known list.
    } finally {
      setLoaded(true);
    }
  }, [all]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          all ? "/api/radio/stations?all=1" : "/api/radio/stations",
          { cache: "no-store" },
        );
        if (cancelled || !response.ok) return;
        const body = (await response.json()) as Payload;
        if (cancelled) return;
        setStations(body.stations ?? []);
        setHasProperty(body.hasProperty !== false);
      } catch {
        // Keep last known list.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [all]);

  useEffect(() => {
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(RADIO_STATIONS_EVENT, onChange);
    window.addEventListener("focus", onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      window.removeEventListener(RADIO_STATIONS_EVENT, onChange);
      window.removeEventListener("focus", onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [refresh]);

  const visible = stations.filter((s) => s.is_visible);
  const visibleCount = visible.length;
  const atVisibleCap = visibleCount >= MAX_VISIBLE_STATIONS;

  return {
    stations,
    visible,
    visibleCount,
    atVisibleCap,
    loaded,
    hasProperty,
    refresh,
    setStations,
  };
}

const tunedListeners = new Set<() => void>();
let tunedMemory: string | null | undefined;

function emitTuned() {
  for (const listener of tunedListeners) listener();
}

export function readTunedStationId(): string | null {
  if (tunedMemory !== undefined) return tunedMemory;
  if (typeof window === "undefined") return null;
  tunedMemory = window.localStorage.getItem(RADIO_TUNED_ID_KEY);
  return tunedMemory;
}

export function writeTunedStationId(id: string | null) {
  tunedMemory = id;
  if (typeof window !== "undefined") {
    if (id) window.localStorage.setItem(RADIO_TUNED_ID_KEY, id);
    else window.localStorage.removeItem(RADIO_TUNED_ID_KEY);
  }
  emitTuned();
}

export function useTunedStationId(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      tunedListeners.add(onStoreChange);
      return () => {
        tunedListeners.delete(onStoreChange);
      };
    },
    readTunedStationId,
    () => null,
  );
}
