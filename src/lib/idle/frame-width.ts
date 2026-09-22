/** Tablet portrait and up. Phones — including landscape — stay below this. */
export const FRAME_WIDTH_MQ = "(min-width: 768px)";

export function isFrameViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(FRAME_WIDTH_MQ).matches;
}

/** Wake lock and idle frame only on tablet/desktop. Never a phone in a pocket. */
export function canHoldScreenAwake(): boolean {
  return isFrameViewport();
}
