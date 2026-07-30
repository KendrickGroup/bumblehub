/**
 * Photorealistic Gusset & Rivet take-home card.
 *
 * Frame asset: public/brand/cabinet-card-frame.png (819×1024)
 * The black PHOTO WINDOW in the source art is punched to transparent
 * so the portrait draws underneath; wood, gussets, and cream plate stay opaque.
 *
 * Bounds measured at native resolution (see scripts notes / debug pass):
 *   PHOTO_WINDOW  — solid black inset where the portrait sits
 *   NAMEPLATE     — cream plate where title text is painted
 */

/** Native size and measured regions of cabinet-card-frame.png */
export const CABINET_FRAME = {
  src: "/brand/cabinet-card-frame.png",
  width: 819,
  height: 1024,
  /** Exact pixel bounds of the black photo window. */
  photoWindow: {
    x: 83,
    y: 107,
    width: 656,
    height: 557,
  },
  /** Exact pixel bounds of the cream nameplate (including bolt area). */
  nameplate: {
    x: 172,
    y: 744,
    width: 460,
    height: 166,
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

/** Cover-fit `img` into the destination rect (centered crop). */
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

async function ensureCardFonts() {
  if (typeof document === "undefined") return;

  const linkId = "cabinet-card-google-fonts";
  if (!document.getElementById(linkId)) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Rye&display=swap";
    document.head.appendChild(link);
  }

  if (!document.fonts) return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('64px "Rye"'),
      document.fonts.load('28px "IM Fell English SC"'),
    ]);
  } catch {
    // fall through with system serif
  }
}

function fillTextWithTracking(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  trackingEm: number,
) {
  const size = parseFloat(ctx.font) || 16;
  const tracking = size * trackingEm;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += ctx.measureText(text[i]!).width;
    if (i < text.length - 1) total += tracking;
  }
  let cx = x - total / 2;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/**
 * Paint title onto the cream nameplate (~12% padding, worn-paint feel).
 */
function drawNameplateText(
  ctx: CanvasRenderingContext2D,
  plate: { x: number; y: number; width: number; height: number },
) {
  const padX = plate.width * 0.12;
  const padY = plate.height * 0.12;
  const innerW = plate.width - padX * 2;
  const innerH = plate.height - padY * 2;
  const cx = plate.x + plate.width / 2;
  const cy = plate.y + plate.height / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.92;
  ctx.filter = "blur(0.5px)";

  // Title — largest line that fits
  let titleSize = Math.floor(innerH * 0.42);
  ctx.font = `400 ${titleSize}px Rye, Georgia, serif`;
  while (
    titleSize > 18 &&
    ctx.measureText("Latigo Ranch House").width > innerW
  ) {
    titleSize -= 1;
    ctx.font = `400 ${titleSize}px Rye, Georgia, serif`;
  }
  ctx.fillStyle = "#241A12";
  const titleY = cy - innerH * 0.14;
  ctx.fillText("Latigo Ranch House", cx, titleY);

  // Subtitle — letterspaced small-caps
  let subSize = Math.floor(titleSize * 0.38);
  const sub = "SUTTER CREEK, CALIFORNIA";
  const fell = '"IM Fell English SC", "Times New Roman", Georgia, serif';
  ctx.font = `400 ${subSize}px ${fell}`;
  // Measure with tracking ~0.22em
  const measureTracked = () => {
    const tracking = subSize * 0.22;
    let total = 0;
    for (let i = 0; i < sub.length; i++) {
      total += ctx.measureText(sub[i]!).width;
      if (i < sub.length - 1) total += tracking;
    }
    return total;
  };
  while (subSize > 10 && measureTracked() > innerW) {
    subSize -= 1;
    ctx.font = `400 ${subSize}px ${fell}`;
  }
  ctx.fillStyle = "#B3402A";
  const subY = cy + innerH * 0.28;
  fillTextWithTracking(ctx, sub, cx, subY, 0.22);

  ctx.restore();
}

/**
 * Composite finished portrait into the photorealistic frame and return JPEG.
 */
export async function renderCabinetCard(
  portrait: HTMLImageElement,
): Promise<Blob | null> {
  await ensureCardFonts();

  const { width, height, photoWindow, nameplate, src } = CABINET_FRAME;

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

  // Underlay in the punched window (avoids bright edges if alpha fringes)
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(
    photoWindow.x,
    photoWindow.y,
    photoWindow.width,
    photoWindow.height,
  );

  drawCover(
    ctx,
    portrait,
    photoWindow.x,
    photoWindow.y,
    photoWindow.width,
    photoWindow.height,
  );
  ctx.drawImage(frame, 0, 0, width, height);
  drawNameplateText(ctx, nameplate);

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
