export const IDLE_DRIFT_MINUTES = [1, 3, 5, 10] as const;
export type IdleDriftMinutes = (typeof IDLE_DRIFT_MINUTES)[number];

export type IdleDriftSettings = {
  enabled: boolean;
  minutes: IdleDriftMinutes;
};

export const DEFAULT_IDLE_DRIFT_SETTINGS: IdleDriftSettings = {
  enabled: true,
  minutes: 3,
};

export const IDLE_RETURN_PATH_KEY = "bumblehub:idle-return-path";
export const IDLE_DRIFT_SETTINGS_EVENT = "bumblehub:idle-drift-settings";
export const IDLE_DRIFT_SETTINGS_CACHE_KEY =
  "bumblehub:idle-drift-settings-cache";

export function cacheIdleDriftSettings(settings: IdleDriftSettings): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    IDLE_DRIFT_SETTINGS_CACHE_KEY,
    JSON.stringify(settings),
  );
  window.dispatchEvent(
    new CustomEvent(IDLE_DRIFT_SETTINGS_EVENT, { detail: settings }),
  );
}

export function readCachedIdleDriftSettings(): IdleDriftSettings | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(IDLE_DRIFT_SETTINGS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IdleDriftSettings;
  } catch {
    return null;
  }
}

export function parseIdleDriftSettings(
  dashboardLayout: unknown,
): IdleDriftSettings {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return { ...DEFAULT_IDLE_DRIFT_SETTINGS };
  }

  const layout = dashboardLayout as Record<string, unknown>;
  const enabled =
    typeof layout.idle_drift_enabled === "boolean"
      ? layout.idle_drift_enabled
      : DEFAULT_IDLE_DRIFT_SETTINGS.enabled;

  const rawMinutes = layout.idle_drift_minutes;
  const minutes =
    typeof rawMinutes === "number" &&
    (IDLE_DRIFT_MINUTES as readonly number[]).includes(rawMinutes)
      ? (rawMinutes as IdleDriftMinutes)
      : DEFAULT_IDLE_DRIFT_SETTINGS.minutes;

  return { enabled, minutes };
}

export function isSafeReturnPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.startsWith("/hive/slideshow")) return false;
  if (path.startsWith("/login") || path.startsWith("/api")) return false;
  return true;
}
