/**
 * Where the 108px banner well looks into a product photo.
 *
 * A Shopify shot is a whole shirt, so the well shows a square window into it.
 * The window is stored as fractions of the source image — never pixels — so it
 * survives Shopify serving the same photo at another size, and the original is
 * never cropped or re-hosted. The card in PART 5 still shows the full flat lay.
 */

export type BannerFrame = { x: number; y: number; w: number; h: number };

/** A window smaller than this is past the point of usable resolution. */
export const FRAME_MIN_SIDE = 0.12;
export const FRAME_DEFAULT_SIDE = 0.6;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * The window must be square in pixels, so its width and height fractions
 * differ whenever the photo is not square: side / imageWidth vs side / height.
 */
export function frameFromSquare(
  side: number,
  cx: number,
  cy: number,
  imageWidth: number,
  imageHeight: number,
): BannerFrame {
  const shortest = Math.min(imageWidth, imageHeight) || 1;
  const sidePx = Math.max(FRAME_MIN_SIDE, Math.min(1, side)) * shortest;
  const w = Math.min(1, sidePx / (imageWidth || 1));
  const h = Math.min(1, sidePx / (imageHeight || 1));
  const x = clamp01(cx - w / 2);
  const y = clamp01(cy - h / 2);
  return {
    x: round4(Math.min(x, 1 - w)),
    y: round4(Math.min(y, 1 - h)),
    w: round4(w),
    h: round4(h),
  };
}

export function defaultFrame(
  imageWidth: number,
  imageHeight: number,
): BannerFrame {
  return frameFromSquare(
    FRAME_DEFAULT_SIDE,
    0.5,
    0.5,
    imageWidth || 1,
    imageHeight || 1,
  );
}

/** Side length of the window as a fraction of the photo's shorter edge. */
export function frameSide(
  frame: BannerFrame,
  imageWidth: number,
  imageHeight: number,
): number {
  const shortest = Math.min(imageWidth, imageHeight) || 1;
  const sidePx = frame.w * (imageWidth || 1);
  return sidePx / shortest;
}

export function frameCenter(frame: BannerFrame): { cx: number; cy: number } {
  return { cx: frame.x + frame.w / 2, cy: frame.y + frame.h / 2 };
}

export function parseBannerFrame(raw: unknown): BannerFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const x = Number(row.x);
  const y = Number(row.y);
  const w = Number(row.w);
  const h = Number(row.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  if (w <= 0 || h <= 0 || w > 1.0001 || h > 1.0001) return null;
  return {
    x: round4(clamp01(Math.min(x, 1 - Math.min(w, 1)))),
    y: round4(clamp01(Math.min(y, 1 - Math.min(h, 1)))),
    w: round4(Math.min(w, 1)),
    h: round4(Math.min(h, 1)),
  };
}

/**
 * Absolute inset for an <img> inside a square well: blow the photo up so the
 * window fills the well, then slide the window's top-left to the well's corner.
 */
export function frameImageStyle(frame: BannerFrame | null): {
  width: string;
  height: string;
  left: string;
  top: string;
} {
  if (!frame || frame.w <= 0 || frame.h <= 0) {
    return { width: "100%", height: "100%", left: "0%", top: "0%" };
  }
  return {
    width: `${round4(100 / frame.w)}%`,
    height: `${round4(100 / frame.h)}%`,
    left: `${round4(-(frame.x / frame.w) * 100)}%`,
    top: `${round4(-(frame.y / frame.h) * 100)}%`,
  };
}
