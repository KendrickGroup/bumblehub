import {
  getParlorProp,
  parlorPropSrc,
  type PortraitPropObject,
  PORTRAIT_CANVAS_H,
  PORTRAIT_CANVAS_W,
} from "./parlor-props";
import { applyFinishToBlob, type PortraitFinish } from "./finish";
import { blobToImage } from "./segmentation";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("prop image load failed"));
    img.src = src;
  });
}

/**
 * Composite clean portrait + placed props, then apply finish over the whole frame.
 */
export async function flattenPortraitWithProps(
  clean: Blob,
  objects: PortraitPropObject[],
  finish: PortraitFinish,
  quality = 0.92,
): Promise<Blob | null> {
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

  const sx = w / PORTRAIT_CANVAS_W;
  const sy = h / PORTRAIT_CANVAS_H;
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const obj of sorted) {
    const def = getParlorProp(obj.propId);
    if (!def) continue;
    try {
      const propImg = await loadImage(parlorPropSrc(def));
      ctx.save();
      ctx.translate(obj.x * sx, obj.y * sy);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      const pw = obj.width * sx;
      const ph = obj.height * sy;
      ctx.drawImage(propImg, -pw / 2, -ph / 2, pw, ph);
      ctx.restore();
    } catch {
      // skip missing art
    }
  }

  if (finish === "color") {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    });
  }

  return applyFinishToBlob(canvas, finish, quality);
}
