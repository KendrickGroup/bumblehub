import { drawBackground } from "./backgrounds";
import type {
  ScrapbookDoc,
  ScrapbookFontId,
  ScrapbookObject,
} from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

const FONT_STACK: Record<ScrapbookFontId, string> = {
  marker: '"Permanent Marker", cursive',
  fraunces: "var(--font-fraunces), Georgia, serif",
  slab: '"Alfa Slab One", Georgia, serif',
  typewriter: '"Special Elite", "Courier New", monospace',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('48px "Permanent Marker"'),
      document.fonts.load('48px "Alfa Slab One"'),
      document.fonts.load('48px "Special Elite"'),
      document.fonts.load("48px Fraunces"),
    ]);
  } catch {
    // fall through with fallbacks
  }
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: ScrapbookObject,
  images: Map<string, HTMLImageElement>,
  stickerDrawer: (
    ctx: CanvasRenderingContext2D,
    id: string,
    size: number,
  ) => void,
) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate((obj.rotation * Math.PI) / 180);

  if (obj.type === "photo") {
    const img = images.get(obj.src);
    const pw = obj.width;
    const ph = obj.height;
    const border = Math.max(8, pw * 0.04);
    const bottomExtra = border * 1.8;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillRect(
      -pw / 2 - border,
      -ph / 2 - border,
      pw + border * 2,
      ph + border + bottomExtra,
    );
    ctx.shadowColor = "transparent";
    if (img) {
      ctx.drawImage(img, -pw / 2, -ph / 2, pw, ph);
    } else {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    }
  } else if (obj.type === "sticker") {
    const size = Math.max(obj.width, obj.height);
    stickerDrawer(ctx, obj.stickerId, size);
  } else if (obj.type === "text") {
    const fontSize = Math.max(16, obj.height * 0.55);
    ctx.font = `700 ${fontSize}px ${FONT_STACK[obj.font]}`;
    ctx.fillStyle = obj.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = (obj.text || " ").split("\n");
    const lineH = fontSize * 1.15;
    const startY = -((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, startY + i * lineH, obj.width);
    });
  }

  ctx.restore();
}

/**
 * Flatten scrapbook doc to a JPEG blob (~1920×1440).
 * stickerDrawer draws a sticker centered at origin after transform.
 */
export async function flattenScrapbook(
  doc: ScrapbookDoc,
  stickerDrawer: (
    ctx: CanvasRenderingContext2D,
    id: string,
    size: number,
  ) => void,
  exportW = 1920,
  exportH = 1440,
): Promise<Blob | null> {
  await ensureFonts();

  const canvas = document.createElement("canvas");
  canvas.width = exportW;
  canvas.height = exportH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const scaleX = exportW / CANVAS_W;
  const scaleY = exportH / CANVAS_H;
  ctx.scale(scaleX, scaleY);

  drawBackground(ctx, doc.background, CANVAS_W, CANVAS_H);

  const photoSrcs = [
    ...new Set(
      doc.objects
        .filter((o): o is Extract<ScrapbookObject, { type: "photo" }> =>
          o.type === "photo",
        )
        .map((o) => o.src),
    ),
  ];
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    photoSrcs.map(async (src) => {
      try {
        images.set(src, await loadImage(src));
      } catch {
        // skip missing
      }
    }),
  );

  const sorted = [...doc.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    drawObject(ctx, obj, images, stickerDrawer);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export function fontCssFamily(id: ScrapbookFontId): string {
  return FONT_STACK[id];
}
