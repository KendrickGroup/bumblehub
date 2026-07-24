"use client";

import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

let segmenterPromise: Promise<ImageSegmenter | null> | null = null;

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

/**
 * Lazily create a selfie ImageSegmenter. Returns null on any failure
 * (model load, WASM, unsupported browser) — callers must fall back silently.
 */
export function loadSelfieSegmenter(): Promise<ImageSegmenter | null> {
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      try {
        return await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "IMAGE",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      } catch {
        // iPad Safari / older GPUs: retry on CPU.
        return await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      }
    } catch {
      return null;
    }
  })();

  return segmenterPromise;
}

type MpMask = {
  width: number;
  height: number;
  getAsFloat32Array: () => Float32Array;
  close: () => void;
};

/**
 * SelfieSegmenter categories: background=0, person=1.
 * Prefer the person confidence channel when both are present.
 */
function personConfidenceFloats(
  masks: MpMask[] | undefined | null,
): { floats: Float32Array; maskWidth: number; maskHeight: number } | null {
  if (!masks || masks.length === 0) return null;
  // Index 1 = person when the model emits both channels; otherwise a single
  // mask is treated as person probability (legacy / single-output builds).
  const person = masks.length >= 2 ? masks[1]! : masks[0]!;
  return {
    floats: person.getAsFloat32Array(),
    maskWidth: person.width,
    maskHeight: person.height,
  };
}

/**
 * If the bright region is mostly on the border (background), invert so the
 * person (typically centered in a selfie) has high alpha.
 */
function ensurePersonHighAlpha(mask: ImageData): ImageData {
  const { width, height, data } = mask;
  const margin = Math.max(2, Math.floor(Math.min(width, height) * 0.06));
  const cx0 = Math.floor(width * 0.3);
  const cx1 = Math.floor(width * 0.7);
  const cy0 = Math.floor(height * 0.2);
  const cy1 = Math.floor(height * 0.8);

  let borderSum = 0;
  let borderCount = 0;
  let centerSum = 0;
  let centerCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]!;
      const onBorder =
        x < margin ||
        y < margin ||
        x >= width - margin ||
        y >= height - margin;
      if (onBorder) {
        borderSum += a;
        borderCount += 1;
      }
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        centerSum += a;
        centerCount += 1;
      }
    }
  }

  if (borderCount === 0 || centerCount === 0) return mask;
  const borderAvg = borderSum / borderCount;
  const centerAvg = centerSum / centerCount;
  // Already person-bright in the center — keep as-is.
  if (centerAvg + 12 >= borderAvg) return mask;

  const out = new ImageData(width, height);
  for (let i = 0; i < data.length; i += 4) {
    out.data[i] = 255;
    out.data[i + 1] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = 255 - data[i + 3]!;
  }
  return out;
}

/**
 * Run selfie segmentation once. Returns an ImageData mask (person=255 alpha)
 * matching the source dimensions, or null on failure.
 */
export async function segmentPersonMask(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<ImageData | null> {
  const segmenter = await loadSelfieSegmenter();
  if (!segmenter) return null;

  try {
    const width =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) return null;

    return await new Promise<ImageData | null>((resolve) => {
      try {
        segmenter.segment(source, (result) => {
          try {
            const extracted = personConfidenceFloats(result.confidenceMasks);
            if (!extracted) {
              resolve(null);
              return;
            }

            const { floats, maskWidth, maskHeight } = extracted;
            const raw = new ImageData(maskWidth, maskHeight);
            for (let i = 0; i < floats.length; i++) {
              const a = Math.round(Math.min(1, Math.max(0, floats[i]!)) * 255);
              const o = i * 4;
              raw.data[o] = 255;
              raw.data[o + 1] = 255;
              raw.data[o + 2] = 255;
              raw.data[o + 3] = a;
            }

            for (const m of result.confidenceMasks ?? []) {
              m.close();
            }

            let personMask = ensurePersonHighAlpha(raw);

            // Scale mask to the source frame when MediaPipe returns a
            // different resolution than the capture.
            if (maskWidth !== width || maskHeight !== height) {
              const srcCanvas = document.createElement("canvas");
              srcCanvas.width = maskWidth;
              srcCanvas.height = maskHeight;
              const sctx = srcCanvas.getContext("2d");
              if (!sctx) {
                resolve(null);
                return;
              }
              sctx.putImageData(personMask, 0, 0);

              const dstCanvas = document.createElement("canvas");
              dstCanvas.width = width;
              dstCanvas.height = height;
              const dctx = dstCanvas.getContext("2d");
              if (!dctx) {
                resolve(null);
                return;
              }
              dctx.imageSmoothingEnabled = true;
              dctx.drawImage(srcCanvas, 0, 0, width, height);
              personMask = dctx.getImageData(0, 0, width, height);
            }

            resolve(personMask);
          } catch {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

function featherMaskAlpha(mask: ImageData, radius = 2): ImageData {
  const { width, height, data } = mask;
  const src = new Uint8ClampedArray(data);
  const out = new ImageData(width, height);
  const r = Math.max(1, radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += src[(ny * width + nx) * 4 + 3]!;
          count += 1;
        }
      }
      const i = (y * width + x) * 4;
      const a = Math.round(sum / count);
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = a;
    }
  }
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    // Keep object URL until decode settles; revoke after a tick.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Composite person (from original + mask) over a backdrop image.
 * Feather mask edge ~2–3px. Returns JPEG blob.
 *
 * Important: putImageData ignores globalCompositeOperation, so the mask must
 * be applied via drawImage for destination-in to clip the captured photo.
 */
export async function compositeWithBackdrop(
  original: HTMLImageElement,
  mask: ImageData,
  backdropUrl: string,
): Promise<Blob | null> {
  try {
    const width = original.naturalWidth;
    const height = original.naturalHeight;
    if (!width || !height) return null;

    const softMask = featherMaskAlpha(mask, 2);
    const backdrop = await loadImage(backdropUrl);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Cover-fit backdrop
    const br = backdrop.naturalWidth / backdrop.naturalHeight;
    const cr = width / height;
    let sx = 0;
    let sy = 0;
    let sw = backdrop.naturalWidth;
    let sh = backdrop.naturalHeight;
    if (br > cr) {
      sw = backdrop.naturalHeight * cr;
      sx = (backdrop.naturalWidth - sw) / 2;
    } else {
      sh = backdrop.naturalWidth / cr;
      sy = (backdrop.naturalHeight - sh) / 2;
    }
    ctx.drawImage(backdrop, sx, sy, sw, sh, 0, 0, width, height);

    const personCanvas = document.createElement("canvas");
    personCanvas.width = width;
    personCanvas.height = height;
    const pctx = personCanvas.getContext("2d", { willReadFrequently: false });
    if (!pctx) return null;

    // a) captured photo
    pctx.drawImage(original, 0, 0, width, height);

    // Mask canvas so we can drawImage (putImageData cannot destination-in).
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const mctx = maskCanvas.getContext("2d");
    if (!mctx) return null;
    mctx.putImageData(softMask, 0, 0);

    // b) keep only person pixels (feathered alpha)
    pctx.globalCompositeOperation = "destination-in";
    pctx.drawImage(maskCanvas, 0, 0);

    // c+d) person on top of backdrop
    ctx.drawImage(personCanvas, 0, 0);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  } catch {
    return null;
  }
}
