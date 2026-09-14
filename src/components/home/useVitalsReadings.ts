"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchHomeAssistantClientConfig,
  haStates,
  HomeAssistantUnreachableError,
} from "@/lib/home-assistant/client";
import {
  formatVitalValue,
  mappedVitals,
  minutesAgoLabel,
  type VitalReading,
  type VitalSlot,
  type VitalsConfig,
} from "@/lib/home/vitals";

type Snapshot =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; readings: VitalReading[] };

export function useVitalsReadings(config: VitalsConfig): Snapshot {
  const [snapshot, setSnapshot] = useState<Snapshot>(() =>
    mappedVitals(config).length === 0 ? { status: "empty" } : { status: "loading" },
  );

  const load = useCallback(async () => {
    const mapped = mappedVitals(config);
    if (mapped.length === 0) {
      setSnapshot({ status: "empty" });
      return;
    }
    try {
      const ha = await fetchHomeAssistantClientConfig();
      if (!ha.url || !ha.token || !ha.connected) {
        setSnapshot({
          status: "ready",
          readings: mapped.map((item) => placeholder(item.slot, item.entityId, true)),
        });
        return;
      }
      const states = await haStates(ha.url, ha.token);
      const byId = new Map(states.map((s) => [s.entity_id, s]));
      const readings = mapped.map(({ slot, entityId }) => {
        const state = byId.get(entityId);
        if (!state) return placeholder(slot, entityId, true);
        const unit =
          typeof state.attributes.unit_of_measurement === "string"
            ? state.attributes.unit_of_measurement
            : null;
        const deviceClass =
          typeof state.attributes.device_class === "string"
            ? state.attributes.device_class
            : null;
        const name =
          typeof state.attributes.friendly_name === "string"
            ? state.attributes.friendly_name
            : entityId;
        const formatted = formatVitalValue(state.state, unit, deviceClass);
        return {
          slot,
          entityId,
          name,
          display: formatted.display,
          numeric: formatted.numeric,
          unit,
          percent: formatted.percent,
          updatedAt: state.last_updated ?? state.last_changed ?? null,
          unreachable: false,
        };
      });
      setSnapshot({ status: "ready", readings });
    } catch (err) {
      const unreachable =
        err instanceof HomeAssistantUnreachableError ||
        (err instanceof Error && /abort|reach|network/i.test(err.message));
      setSnapshot({
        status: "ready",
        readings: mapped.map((item) =>
          placeholder(item.slot, item.entityId, unreachable || true),
        ),
      });
    }
  }, [config]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  return snapshot;
}

function placeholder(
  slot: VitalSlot,
  entityId: string,
  unreachable: boolean,
): VitalReading {
  return {
    slot,
    entityId,
    name: slot,
    display: "—",
    numeric: null,
    unit: null,
    percent: null,
    updatedAt: null,
    unreachable,
  };
}

export function updatedLabel(reading: VitalReading): string {
  return minutesAgoLabel(reading.updatedAt);
}
