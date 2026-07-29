export const CANVAS_W = 1200;
export const CANVAS_H = 900; // 4:3 landscape

export type ScrapbookBgId =
  | "barnwood"
  | "cork"
  | "linen"
  | "chalkboard"
  | "honey";

export type ScrapbookFontId =
  | "marker"
  | "fraunces"
  | "slab"
  | "typewriter";

export type ScrapbookStickerId =
  | "googly"
  | "mustache"
  | "cowboy-hat"
  | "sunglasses"
  | "heart"
  | "star"
  | "washi-a"
  | "washi-b"
  | "bandaid"
  | "arrow"
  | "speech"
  | "banner"
  | "horseshoe"
  | "bee"
  | "cactus"
  | "boot";

export type ScrapbookTextColor =
  | "#1a1a1a"
  | "#FAF8F3"
  | "#F4B400"
  | "#B3402A"
  | "#7C8B6F"
  | "#3E5C76"
  | "#ffffff"
  | "#000000";

type BaseObject = {
  id: string;
  x: number; // center x in canvas coords
  y: number; // center y
  width: number;
  height: number;
  rotation: number; // degrees
  zIndex: number;
};

export type PhotoObject = BaseObject & {
  type: "photo";
  photoId: string;
  src: string;
};

export type StickerObject = BaseObject & {
  type: "sticker";
  stickerId: ScrapbookStickerId;
};

export type TextObject = BaseObject & {
  type: "text";
  text: string;
  font: ScrapbookFontId;
  color: ScrapbookTextColor;
};

export type ScrapbookObject = PhotoObject | StickerObject | TextObject;

export type ScrapbookDoc = {
  background: ScrapbookBgId;
  objects: ScrapbookObject[];
  nextZ: number;
};

export const TEXT_COLORS: ScrapbookTextColor[] = [
  "#1a1a1a",
  "#FAF8F3",
  "#F4B400",
  "#B3402A",
  "#7C8B6F",
  "#3E5C76",
  "#ffffff",
  "#000000",
];

export const FONT_LABELS: Record<ScrapbookFontId, string> = {
  marker: "Marker",
  fraunces: "Fraunces",
  slab: "Slab",
  typewriter: "Typewriter",
};

export const MIN_OBJECT_SIZE = 40;
export const MAX_OBJECT_FRAC = 0.9;
