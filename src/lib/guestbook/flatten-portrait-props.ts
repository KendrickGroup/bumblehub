import {
  getParlorProp,
  parlorPropSrc,
  PORTRAIT_CANVAS_H,
  PORTRAIT_CANVAS_W,
} from "./parlor-props";
import {
  parlorFontCss,
  type PortraitOverlayObject,
} from "./parlor-overlay";
import { applyFinishToBlob, FINISH_CSS, type PortraitFinish } from "./finish";
import { getRepairedPropCanvas } from "./repair-prop-image";
import { blobToImage } from "./capture";

async function ensureOverlayFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('48px "Rye"'),
      document.fonts.load('48px "Permanent Marker"'),
      document.fonts.load('48px "Special Elite"'),
    ]);
  } catch {
    // fall through
  }
}

/**
 * Match on-screen CSS:
 * translate(center) → rotate → scaleX(flip) → scaleY(tilt squash)
 */
function applyOverlayTransform(
  ctx: CanvasRenderingContext2D,
  obj: PortraitOverlayObject,
  sx: number,
  sy: number,
) {
  const flipX = obj.flipX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  ctx.translate(obj.x * sx, obj.y * sy);
  ctx.rotate((obj.rotation * Math.PI) / 180);
  ctx.scale(flipX, scaleY);
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function paintOverlays(
  ctx: CanvasRenderingContext2D,
  objects: PortraitOverlayObject[],
  w: number,
  h: number,
) {
  const sx = w / PORTRAIT_CANVAS_W;
  const sy = h / PORTRAIT_CANVAS_H;
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const obj of sorted) {
    ctx.save();
    applyOverlayTransform(ctx, obj, sx, sy);

    if (obj.kind === "prop") {
      const def = getParlorProp(obj.propId);
      if (def) {
        try {
          const propImg = await getRepairedPropCanvas(parlorPropSrc(def));
          const pw = obj.width * sx;
          const ph = obj.height * sy;
          ctx.drawImage(propImg, -pw / 2, -ph / 2, pw, ph);
        } catch {
          // skip missing art
        }
      }
    } else {
      const fontSize = Math.max(16, obj.height * sy * 0.55);
      ctx.font = `700 ${fontSize}px ${parlorFontCss(obj.font)}`;
      ctx.fillStyle = obj.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (obj.color === "#FAF3E3") {
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 4;
      }
      const lines = (obj.text || " ").split("\n");
      const lineH = fontSize * 1.15;
      const startY = -((lines.length - 1) * lineH) / 2;
      const maxW = obj.width * sx;
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineH, maxW);
      });
      ctx.shadowColor = "transparent";
    }

    ctx.restore();
  }
}

/**
 * Composite the plate with props and text.
 * When the plate already has Finish baked (a server scene), Finish is applied
 * only to the stickers so the portrait is not filtered a second time.
 */
export async function flattenPortraitWithProps(
  clean: Blob,
  objects: PortraitOverlayObject[],
  finish: PortraitFinish,
  quality = 0.92,
  options?: { plateAlreadyFinished?: boolean },
): Promise<Blob | null> {
  await ensureOverlayFonts();

  if (options?.plateAlreadyFinished && objects.length === 0) {
    return clean;
  }

  const base = await blobToImage(clean);
  const w = base.naturalWidth;
  const h = base.naturalHeight;
  if (!w || !h) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(base, 0, 0, w, h);

  if (options?.plateAlreadyFinished) {
    const stickers = document.createElement("canvas");
    stickers.width = w;
    stickers.height = h;
    const sctx = stickers.getContext("2d");
    if (!sctx) return canvasToJpeg(canvas, quality);
    await paintOverlays(sctx, objects, w, h);
    if (finish === "color") {
      ctx.drawImage(stickers, 0, 0);
      return canvasToJpeg(canvas, quality);
    }
    const filtered = document.createElement("canvas");
    filtered.width = w;
    filtered.height = h;
    const fctx = filtered.getContext("2d");
    if (!fctx) return canvasToJpeg(canvas, quality);
    fctx.filter = FINISH_CSS[finish];
    fctx.drawImage(stickers, 0, 0);
    ctx.drawImage(filtered, 0, 0);
    return canvasToJpeg(canvas, quality);
  }

  await paintOverlays(ctx, objects, w, h);

  if (finish === "color") {
    return canvasToJpeg(canvas, quality);
  }

  return applyFinishToBlob(canvas, finish, quality);
}
