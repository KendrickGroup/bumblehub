/** Browser pixel ratio used when choosing a bitmap. Never above 3x. */
export const MAX_DEVICE_PIXEL_RATIO = 3;

export function devicePixelScale(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 1) return 1;
  return Math.min(MAX_DEVICE_PIXEL_RATIO, dpr);
}

/** CSS pixels times the screen's pixel ratio, capped at 3x. */
export function retinaPixels(cssPx: number, dpr: number): number {
  return Math.max(1, Math.round(cssPx * devicePixelScale(dpr)));
}
