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
