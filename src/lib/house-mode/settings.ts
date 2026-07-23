export const HOUSE_MODE_DEVICE_KEY = "bumblehub:house-mode";
export const HOUSE_MODE_UNLOCK_KEY = "bumblehub:house-mode-unlocked";

export const DEFAULT_HOUSE_GREETING = "";

export type HouseModeSettings = {
  /** Empty string = use time-of-day defaults with hive name. */
  greeting: string;
  hasPin: boolean;
};

export function parseHouseModeSettings(
  dashboardLayout: unknown,
): Omit<HouseModeSettings, "hasPin"> & { pinHash: string | null } {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return { greeting: DEFAULT_HOUSE_GREETING, pinHash: null };
  }

  const layout = dashboardLayout as Record<string, unknown>;
  const greeting =
    typeof layout.house_mode_greeting === "string"
      ? layout.house_mode_greeting
      : DEFAULT_HOUSE_GREETING;
  const pinHash =
    typeof layout.house_mode_pin_hash === "string" &&
    layout.house_mode_pin_hash.includes(":")
      ? layout.house_mode_pin_hash
      : null;

  return { greeting, pinHash };
}

export function isHouseModeDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HOUSE_MODE_DEVICE_KEY) === "1";
}

export function setHouseModeDevice(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem(HOUSE_MODE_DEVICE_KEY, "1");
  } else {
    window.localStorage.removeItem(HOUSE_MODE_DEVICE_KEY);
    window.sessionStorage.removeItem(HOUSE_MODE_UNLOCK_KEY);
  }
}

export function isHouseModeUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(HOUSE_MODE_UNLOCK_KEY) === "1";
}

export function setHouseModeUnlocked(unlocked: boolean): void {
  if (typeof window === "undefined") return;
  if (unlocked) {
    window.sessionStorage.setItem(HOUSE_MODE_UNLOCK_KEY, "1");
  } else {
    window.sessionStorage.removeItem(HOUSE_MODE_UNLOCK_KEY);
  }
}

/** Hour in property timezone (0–23). */
export function hourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour ? Number(hour) % 24 : date.getHours();
}

export function personalGreeting(firstName: string | null, hour: number): string {
  const period =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  if (firstName) return `${period}, ${firstName}`;
  return period;
}

/**
 * Resolve the house greeting. Custom templates may include `{name}`.
 * Empty custom → time-of-day defaults ("Good morning at the Cabin" / Welcome…).
 */
export function resolveHouseGreeting(
  custom: string,
  propertyName: string,
  hour: number,
): string {
  const name = propertyName.trim() || "home";
  const trimmed = custom.trim();
  if (trimmed) {
    return trimmed.replaceAll("{name}", name);
  }

  if (hour < 12) return `Good morning at ${name}`;
  if (hour < 17) return `Good afternoon at ${name}`;
  return `Welcome to ${name}`;
}

export function firstNameFromUser(input: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = input.user_metadata;
  const fromMeta =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    (typeof meta?.first_name === "string" && meta.first_name) ||
    null;
  if (fromMeta) {
    return fromMeta.trim().split(/\s+/)[0] ?? null;
  }
  const email = input.email;
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const token = local.split(/[._-]/)[0] ?? "";
  if (!token) return null;
  return token.charAt(0).toUpperCase() + token.slice(1);
}
