import { formatRelativeDate, formatSlideshowDate } from "@/lib/hive/format";

/**
 * Display date for guestbook photos: only `taken_at` (real capture / edited date).
 * Never fall back to `created_at` (upload time).
 */
export function guestbookTakenDateLabel(
  takenAt: string | null | undefined,
  style: "relative" | "slideshow" = "relative",
): string {
  if (!takenAt) return "";
  return style === "slideshow"
    ? formatSlideshowDate(takenAt)
    : formatRelativeDate(takenAt);
}

/** YYYY-MM-DD for <input type="date"> in local time. */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse date input to ISO; empty → null. Uses local noon to avoid TZ day shifts. */
export function fromDateInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
