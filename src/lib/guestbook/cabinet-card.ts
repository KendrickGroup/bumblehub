/**
 * E1 “Gusset & Rivet” take-home card.
 *
 * The decorative frame (wood, gussets, sign, type) is a static asset:
 *   public/brand/cabinet-card-frame.png
 * Regenerated via: `npm run render:cabinet-frame`
 * Source HTML: scripts/cabinet-frame-e1.html
 *
 * Per-save work is only: draw the portrait into the window, then the frame on top.
 */

/** Window hole in cabinet-card-frame.png (must match scripts/cabinet-frame-e1.html). */
export const CABINET_FRAME = {
  src: "/brand/cabinet-card-frame.png",
  width: 1600,
  height: 1480,
  window: {
    x: 140,
    y: 120,
    width: 1320,
    height: 990,
  },
} as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Cover-fit `img` into the destination rect. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const rr = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > rr) {
    sw = img.naturalHeight * rr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / rr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * Composite portrait into the E1 frame window and return a JPEG blob.
 */
export async function renderCabinetCard(
  portrait: HTMLImageElement,
): Promise<Blob | null> {
  const { width, height, window: win, src } = CABINET_FRAME;

  let frame: HTMLImageElement;
  try {
    frame = await loadImage(src);
  } catch {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Warm underlay so any anti-aliased hole edge looks like wood, not white
  ctx.fillStyle = "#5c3a22";
  ctx.fillRect(0, 0, width, height);

  drawCover(ctx, portrait, win.x, win.y, win.width, win.height);
  ctx.drawImage(frame, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export function makeShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
