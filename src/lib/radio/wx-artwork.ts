import { WX_BADGE_INK, WX_BADGE_OLIVE } from "./wx-stream";

let cachedUrl: string | null = null;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** PNG data URL of the olive WX badge for Media Session artwork. */
export function wxBadgeArtworkDataUrl(size = 512): string {
  if (cachedUrl) return cachedUrl;
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = WX_BADGE_OLIVE;
  roundRect(ctx, 0, 0, size, size, Math.round(size * 0.18));
  ctx.fill();
  ctx.fillStyle = WX_BADGE_INK;
  ctx.font = `800 ${Math.round(size * 0.38)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WX", size / 2, size / 2 + size * 0.015);
  cachedUrl = canvas.toDataURL("image/png");
  return cachedUrl;
}
