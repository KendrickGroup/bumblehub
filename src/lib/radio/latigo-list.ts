/**
 * The Latigo List, shared between the gate, the route and Settings.
 *
 * Kept free of server imports so the modal and the API route can both read the
 * same numbers.
 */

export const LATIGO_LIST_COOKIE = "latigo_list";
export const LATIGO_LIST_STORAGE_KEY = "latigo_radio_list";
export const LATIGO_LIST_ENDPOINT = "/api/radio/subscribe";

/** Ten years, so a signup outlives the phone it was made on. */
export const LATIGO_LIST_COOKIE_MAX_AGE = 34_560_000;

/** Listening time, not wall clock: first ask after twenty minutes of audio. */
export const LATIGO_FIRST_ASK_SECONDS = 1200;
/** Every "not right now" buys another half hour of listening. */
export const LATIGO_ASK_AGAIN_SECONDS = 1800;

export const EMAIL_MAX = 254;
export const STATION_CALL_MAX = 80;

/** Off unless Vercel says otherwise, so this lands cold. */
export const LATIGO_LIST_ENABLED =
  process.env.NEXT_PUBLIC_LATIGO_LIST_ENABLED === "true";

/**
 * Deliberately loose: one @, a dot in the domain, no spaces. Anything past
 * that is Klaviyo's call, not ours — we are only turning away obvious junk.
 */
const EMAIL_SHAPE = /^[^\s@,;:"'<>()[\]\\]+@[^\s@.,;:"'<>()[\]\\]+(\.[^\s@.,;:"'<>()[\]\\]+)+$/;

export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().slice(0, EMAIL_MAX);
  if (!EMAIL_SHAPE.test(email)) return null;
  // Klaviyo lowercases anyway, and citext makes the column agree.
  return email.toLowerCase();
}

export function cleanStationCall(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw.trim().slice(0, STATION_CALL_MAX) || null;
}
