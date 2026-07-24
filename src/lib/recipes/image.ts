import { downscaleImageFile } from "@/lib/images/downscale";

export { downscaleImageFile };

export function secondsToTimerParts(seconds: number | null): {
  minutes: string;
  seconds: string;
} {
  if (seconds == null || seconds <= 0) {
    return { minutes: "", seconds: "" };
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return { minutes: String(m), seconds: String(s) };
}

export function timerPartsToSeconds(
  minutes: string,
  secs: string,
): number | null {
  const m = minutes.trim() === "" ? 0 : Number(minutes);
  const s = secs.trim() === "" ? 0 : Number(secs);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  const total = Math.round(m) * 60 + Math.round(s);
  return total > 0 ? total : null;
}
