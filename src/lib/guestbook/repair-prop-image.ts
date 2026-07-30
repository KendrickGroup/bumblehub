/** Paper fill for engraved interiors after exterior-only knockouts. */
export const PROP_PAPER = { r: 0xfa, g: 0xf3, b: 0xe3 };

const TRANSPARENT_ALPHA = 32;

type CacheEntry = {
  canvas: HTMLCanvasElement;
  objectUrl: string;
};

const cache = new Map<string, Promise<CacheEntry>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load prop: ${src}`));
    img.src = src;
  });
}

/**
 * Flood-fill from image borders through transparent pixels → exterior.
 * Any transparent pixel NOT reached is an interior hole from aggressive
 * white-keying; restore those to opaque paper white.
 */
export function repairPropInterior(
  source: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  const width =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !width || !height) return canvas;

  ctx.drawImage(source, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  const exterior = new Uint8Array(width * height);

  const isHole = (i: number) => data[i * 4 + 3]! < TRANSPARENT_ALPHA;

  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (exterior[i] || !isHole(i)) return;
    exterior[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let i = 0; i < width * height; i++) {
    if (!isHole(i) || exterior[i]) continue;
    const o = i * 4;
    data[o] = PROP_PAPER.r;
    data[o + 1] = PROP_PAPER.g;
    data[o + 2] = PROP_PAPER.b;
    data[o + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("prop repair blob failed"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

/** Load + repair once; returns object URL for <img> display. */
export function getRepairedPropUrl(src: string): Promise<string> {
  let pending = cache.get(src);
  if (!pending) {
    pending = (async () => {
      const img = await loadImage(src);
      const canvas = repairPropInterior(img);
      const objectUrl = await canvasToObjectUrl(canvas);
      return { canvas, objectUrl };
    })();
    cache.set(src, pending);
  }
  return pending.then((e) => e.objectUrl);
}

/** Same cache; canvas for flattening draws. */
export async function getRepairedPropCanvas(
  src: string,
): Promise<HTMLCanvasElement> {
  let pending = cache.get(src);
  if (!pending) {
    pending = (async () => {
      const img = await loadImage(src);
      const canvas = repairPropInterior(img);
      const objectUrl = await canvasToObjectUrl(canvas);
      return { canvas, objectUrl };
    })();
    cache.set(src, pending);
  }
  return pending.then((e) => e.canvas);
}
