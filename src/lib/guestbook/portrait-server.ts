import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-web";
import sharp, { type Sharp } from "sharp";
import type { PortraitFinish } from "./finish";
import { getParlorScene, type ParlorSceneId } from "./parlor-scenes";

/**
 * Person cutout for the photo booth. Runs in the route handler, never in the
 * browser. The model is the MediaPipe selfie segmenter exported to ONNX
 * (NCHW float, 256×256, person alpha in `alphas`).
 */
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

const MODEL_PATH = path.join(
  process.cwd(),
  "models/selfie-segmentation-fp16.onnx",
);
const INPUT = 256;
const MAX_EDGE = 2560;
const JPEG_QUALITY = 92;

const SEPIA = 0.68;
const SEPIA_MATRIX: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [(1 - SEPIA) + SEPIA * 0.393, SEPIA * 0.769, SEPIA * 0.189],
  [SEPIA * 0.349, (1 - SEPIA) + SEPIA * 0.686, SEPIA * 0.168],
  [SEPIA * 0.272, SEPIA * 0.534, (1 - SEPIA) + SEPIA * 0.131],
];

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
    }).catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

export type PortraitResult =
  | { ok: true; jpeg: Buffer; ms: number }
  | { ok: false; reason: "mask" | "image" | "scene" };

export async function compositePortrait(
  still: Buffer,
  sceneId: ParlorSceneId,
  finish: PortraitFinish,
): Promise<PortraitResult> {
  const started = Date.now();
  const scene = getParlorScene(sceneId);
  if (!scene) return { ok: false, reason: "scene" };

  const frame = await decodeFrame(still);
  if (!frame) return { ok: false, reason: "image" };

  const mask = await personAlpha(frame.rgb, frame.width, frame.height);
  if (!mask || !maskIsUsable(mask, frame.width, frame.height)) {
    return { ok: false, reason: "mask" };
  }

  const soft = featherAlpha(mask, frame.width, frame.height, 2);
  const backdropPath = path.join(
    process.cwd(),
    "public",
    scene.url.replace(/^\//, ""),
  );
  const backdrop = await readFile(backdropPath);
  const background = await sharp(backdrop)
    .rotate()
    .resize(frame.width, frame.height, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const rgb = compositeOver(frame.rgb, background, soft, frame.width, frame.height);
  const jpeg = await applyFinish(
    sharp(rgb, {
      raw: { width: frame.width, height: frame.height, channels: 3 },
    }),
    finish,
  )
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { ok: true, jpeg, ms: Date.now() - started };
}

async function decodeFrame(
  input: Buffer,
): Promise<{ rgb: Buffer; width: number; height: number } | null> {
  const meta = await sharp(input).rotate().metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW < 32 || srcH < 32) return null;

  let pipeline = sharp(input).rotate();
  const edge = Math.max(srcW, srcH);
  if (edge > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: srcW >= srcH ? MAX_EDGE : undefined,
      height: srcH > srcW ? MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const { data, info } = await pipeline
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || info.width < 32 || info.height < 32) return null;
  return { rgb: data, width: info.width, height: info.height };
}

async function personAlpha(
  rgb: Buffer,
  width: number,
  height: number,
): Promise<Uint8Array | null> {
  const small = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .resize(INPUT, INPUT, { fit: "fill" })
    .raw()
    .toBuffer();

  const plane = INPUT * INPUT;
  const nchw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    nchw[i] = small[i * 3]! / 255;
    nchw[plane + i] = small[i * 3 + 1]! / 255;
    nchw[2 * plane + i] = small[i * 3 + 2]! / 255;
  }

  const session = await getSession();
  const result = await session.run({
    pixel_values: new ort.Tensor("float32", nchw, [1, 3, INPUT, INPUT]),
  });
  const alphas = result.alphas;
  if (!alphas || alphas.data.length < plane) return null;

  const raw = new Uint8Array(plane);
  const data = alphas.data;
  for (let i = 0; i < plane; i++) {
    const v = Number(data[i]);
    raw[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }

  const oriented = ensurePersonHighAlpha(raw, INPUT, INPUT);
  const scaled = await sharp(oriented, {
    raw: { width: INPUT, height: INPUT, channels: 1 },
  })
    .resize(width, height, { fit: "fill" })
    .toColourspace("b-w")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = width * height;
  const alpha = new Uint8Array(n);
  const channels = scaled.info.channels;
  if (channels === 1 && scaled.data.length >= n) {
    alpha.set(scaled.data.subarray(0, n));
  } else {
    for (let i = 0; i < n; i++) alpha[i] = scaled.data[i * channels] ?? 0;
  }
  return alpha;
}

/**
 * If the bright region is mostly on the border, the channel is background.
 * Flip it so the person (usually centered) stays opaque.
 */
function ensurePersonHighAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
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
      const a = alpha[y * width + x]!;
      const onBorder =
        x < margin || y < margin || x >= width - margin || y >= height - margin;
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

  if (borderCount === 0 || centerCount === 0) return alpha;
  if (centerSum / centerCount + 12 >= borderSum / borderCount) return alpha;

  const out = new Uint8Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) out[i] = 255 - alpha[i]!;
  return out;
}

/** Reject a cut that would ship a missing person, a halo, or no background. */
function maskIsUsable(alpha: Uint8Array, width: number, height: number): boolean {
  const n = width * height;
  if (n < 64 || alpha.length < n) return false;

  let solid = 0;
  let background = 0;
  let uncertain = 0;
  for (let i = 0; i < n; i++) {
    const a = alpha[i]!;
    if (a >= 200) solid += 1;
    else if (a <= 40) background += 1;
    else uncertain += 1;
  }

  const solidR = solid / n;
  const backgroundR = background / n;
  const uncertainR = uncertain / n;
  if (solidR < 0.05 || solidR > 0.92) return false;
  if (backgroundR < 0.05) return false;
  if (uncertainR > 0.45) return false;
  return true;
}

function featherAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const out = new Uint8Array(alpha.length);
  const r = Math.max(1, radius);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height - 1, y + r);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width - 1, x + r);
      let sum = 0;
      let count = 0;
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          sum += alpha[ny * width + nx]!;
          count += 1;
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return out;
}

function compositeOver(
  person: Buffer,
  background: Buffer,
  alpha: Uint8Array,
  width: number,
  height: number,
): Buffer {
  const out = Buffer.alloc(width * height * 3);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const a = alpha[i]! / 255;
    const inv = 1 - a;
    const p = i * 3;
    out[p] = Math.round(person[p]! * a + background[p]! * inv);
    out[p + 1] = Math.round(person[p + 1]! * a + background[p + 1]! * inv);
    out[p + 2] = Math.round(person[p + 2]! * a + background[p + 2]! * inv);
  }
  return out;
}

function applyFinish(image: Sharp, finish: PortraitFinish): Sharp {
  if (finish === "sepia") {
    return image
      .recomb(SEPIA_MATRIX)
      .linear(1.06, 128 * (1 - 1.06))
      .modulate({ saturation: 0.9 });
  }
  if (finish === "tintype") {
    return image.grayscale().linear(1.12, 128 * (1 - 1.12)).linear(0.96, 0);
  }
  return image;
}
