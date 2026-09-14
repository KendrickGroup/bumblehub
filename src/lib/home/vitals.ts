export const VITAL_SLOTS = ["water", "battery", "solar"] as const;
export type VitalSlot = (typeof VITAL_SLOTS)[number];

export type VitalsConfig = {
  water: string | null;
  battery: string | null;
  solar: string | null;
};

export const DEFAULT_VITALS_CONFIG: VitalsConfig = {
  water: null,
  battery: null,
  solar: null,
};

export const VITAL_SLOT_LABEL: Record<VitalSlot, string> = {
  water: "Water tank",
  battery: "Battery",
  solar: "Solar",
};

export function parseVitalsConfig(dashboardLayout: unknown): VitalsConfig {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return { ...DEFAULT_VITALS_CONFIG };
  }
  const raw = (dashboardLayout as Record<string, unknown>).vitals_config;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VITALS_CONFIG };
  }
  const row = raw as Record<string, unknown>;
  return {
    water: entityIdOrNull(row.water),
    battery: entityIdOrNull(row.battery),
    solar: entityIdOrNull(row.solar),
  };
}

function entityIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.startsWith("sensor.") ? id : null;
}

export function mappedVitals(config: VitalsConfig): Array<{
  slot: VitalSlot;
  entityId: string;
}> {
  return VITAL_SLOTS.flatMap((slot) => {
    const entityId = config[slot];
    return entityId ? [{ slot, entityId }] : [];
  });
}

export type VitalReading = {
  slot: VitalSlot;
  entityId: string;
  name: string;
  display: string;
  numeric: number | null;
  unit: string | null;
  percent: number | null;
  updatedAt: string | null;
  unreachable: boolean;
};

export function formatVitalValue(
  state: string,
  unit: string | null,
  deviceClass: string | null,
): { display: string; numeric: number | null; percent: number | null } {
  if (
    !state ||
    state === "unknown" ||
    state === "unavailable" ||
    state === "none"
  ) {
    return { display: "—", numeric: null, percent: null };
  }
  const numeric = Number(state);
  if (!Number.isFinite(numeric)) {
    return { display: state, numeric: null, percent: null };
  }

  const unitNorm = (unit ?? "").trim();
  const classNorm = (deviceClass ?? "").toLowerCase();
  const isPercent =
    unitNorm === "%" ||
    classNorm === "battery" ||
    classNorm === "humidity" ||
    classNorm === "moisture";

  if (isPercent) {
    const pct = Math.max(0, Math.min(100, Math.round(numeric)));
    return { display: `${pct}%`, numeric, percent: pct };
  }

  const lower = unitNorm.toLowerCase();
  if (lower === "kw" || lower === "kilowatt") {
    const rounded = Math.abs(numeric) >= 10 ? numeric.toFixed(1) : numeric.toFixed(2);
    return { display: `${trimNum(rounded)}kW`, numeric, percent: null };
  }
  if (lower === "w" || lower === "watt") {
    if (Math.abs(numeric) >= 1000) {
      const kw = numeric / 1000;
      const rounded = Math.abs(kw) >= 10 ? kw.toFixed(1) : kw.toFixed(2);
      return { display: `${trimNum(rounded)}kW`, numeric: kw, percent: null };
    }
    return { display: `${Math.round(numeric)}W`, numeric, percent: null };
  }
  if (unitNorm) {
    const shown =
      Math.abs(numeric) >= 100
        ? String(Math.round(numeric))
        : trimNum(numeric.toFixed(1));
    return { display: `${shown}${unitNorm}`, numeric, percent: null };
  }
  return {
    display: trimNum(numeric.toFixed(Math.abs(numeric) >= 10 ? 0 : 1)),
    numeric,
    percent: null,
  };
}

function trimNum(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function minutesAgoLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "updated —";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "updated —";
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return "updated just now";
  if (mins === 1) return "updated 1m ago";
  if (mins < 60) return `updated ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours === 1) return "updated 1h ago";
  return `updated ${hours}h ago`;
}
