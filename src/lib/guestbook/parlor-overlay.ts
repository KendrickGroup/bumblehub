export type ParlorTextFont = "rye" | "marker" | "elite";

export type ParlorTextColor =
  | "#1a1a1a"
  | "#FAF3E3"
  | "#B3402A"
  | "#F4B400";

export const PARLOR_TEXT_FONTS: {
  id: ParlorTextFont;
  label: string;
  css: string;
}[] = [
  { id: "rye", label: "Rye", css: "var(--font-rye), Georgia, serif" },
  {
    id: "marker",
    label: "Marker",
    css: "var(--font-marker), cursive",
  },
  {
    id: "elite",
    label: "Typewriter",
    css: "var(--font-elite), 'Courier New', monospace",
  },
];

export const PARLOR_TEXT_COLORS: ParlorTextColor[] = [
  "#1a1a1a",
  "#FAF3E3",
  "#B3402A",
  "#F4B400",
];

type BaseOverlay = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Horizontal mirror: 1 = normal, -1 = flipped. */
  flipX: 1 | -1;
  /** Vertical squash for tilt feel; 1 = upright, down to 0.55. */
  scaleY: number;
  zIndex: number;
};

export type PortraitPropOverlay = BaseOverlay & {
  kind: "prop";
  propId: string;
};

export type PortraitTextOverlay = BaseOverlay & {
  kind: "text";
  text: string;
  font: ParlorTextFont;
  color: ParlorTextColor;
};

export type PortraitOverlayObject = PortraitPropOverlay | PortraitTextOverlay;

export function parlorFontCss(font: ParlorTextFont): string {
  return PARLOR_TEXT_FONTS.find((f) => f.id === font)?.css ?? "serif";
}

export function isOutsidePortrait(
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
): boolean {
  return x < 0 || x > canvasW || y < 0 || y > canvasH;
}

export const OVERLAY_MIN_SCALE_Y = 0.55;
export const OVERLAY_MAX_SCALE_Y = 1;

export function clampScaleY(v: number): number {
  return Math.min(OVERLAY_MAX_SCALE_Y, Math.max(OVERLAY_MIN_SCALE_Y, v));
}

export function defaultOverlayTransform(): Pick<
  BaseOverlay,
  "flipX" | "scaleY"
> {
  return { flipX: 1, scaleY: 1 };
}
