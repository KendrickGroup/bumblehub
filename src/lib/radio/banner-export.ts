/**
 * Signed-in export of the banner rotation: one framed square per product
 * that has a saved crop, plus a CSV of the text. Missing photos and missing
 * frames are rows in the CSV, not a failed download.
 */

import { crc32 } from "node:zlib";
import sharp from "sharp";
import type { BannerFrame } from "@/lib/radio/banner-frame";
import type { BannerProduct } from "@/lib/radio/banner";

export const BANNER_EXPORT_PX = 1080;
const JPEG_QUALITY = 85;
const FETCH_MS = 12_000;
const MAX_IMAGE_BYTES = 20_000_000;
/** A few photos in flight, written out as each one finishes, so the whole
 *  catalog is not held in memory at once. */
const RENDER_CONCURRENCY = 3;

export type BannerExportRow = {
  title: string;
  handle: string;
  product_url: string;
  pitch: string;
  image_file: string;
  original_image_url: string;
  note: string;
};

const CSV_COLUMNS: (keyof BannerExportRow)[] = [
  "title",
  "handle",
  "product_url",
  "pitch",
  "image_file",
  "original_image_url",
  "note",
];

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function bannerExportCsv(rows: BannerExportRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((key) => csvField(row[key])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Shopify handles are already slugs. Strip anything a zip path should not carry. */
export function bannerExportStem(handle: string): string {
  const stem = handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stem || "product";
}

function uniqueStem(stem: string, used: Set<string>): string {
  if (!used.has(stem)) {
    used.add(stem);
    return stem;
  }
  let n = 2;
  while (used.has(`${stem}-${n}`)) n += 1;
  const next = `${stem}-${n}`;
  used.add(next);
  return next;
}

function cleanProductUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_content",
      "utm_campaign",
    ]) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function isShopImageUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "cdn.shopify.com" ||
      host.endsWith(".shopifycdn.com") ||
      host.endsWith(".myshopify.com") ||
      host === "latigocowboy.com" ||
      host === "www.latigocowboy.com"
    );
  } catch {
    return false;
  }
}

/** Ask Shopify for enough pixels that a tight crop still lands near 1080. */
function renderSourceUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const shopify =
      host === "cdn.shopify.com" ||
      host.endsWith(".shopifycdn.com") ||
      host.endsWith(".myshopify.com");
    if (!shopify) return raw;
    url.searchParams.set("width", "4000");
    return url.toString();
  } catch {
    return raw;
  }
}

function coverRect(
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } | null {
  const side = Math.min(width, height);
  if (side < 2) return null;
  return {
    left: Math.max(0, Math.round((width - side) / 2)),
    top: Math.max(0, Math.round((height - side) / 2)),
    width: side,
    height: side,
  };
}

function frameRect(
  frame: BannerFrame,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } | null {
  const left = Math.max(0, Math.min(width - 1, Math.round(frame.x * width)));
  const top = Math.max(0, Math.min(height - 1, Math.round(frame.y * height)));
  let cropW = Math.max(1, Math.round(frame.w * width));
  let cropH = Math.max(1, Math.round(frame.h * height));
  if (left + cropW > width) cropW = width - left;
  if (top + cropH > height) cropH = height - top;
  if (cropW < 2 || cropH < 2) return null;
  return { left, top, width: cropW, height: cropH };
}

/** The square the banner well shows: the saved window, or a centered cover. */
export async function renderBannerSquare(
  input: Buffer,
  frame: BannerFrame | null,
): Promise<Buffer> {
  const oriented = await sharp(input, { failOn: "none" }).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const rect = frame ? frameRect(frame, width, height) : coverRect(width, height);
  if (!rect) throw new Error("frame");
  return sharp(oriented)
    .extract(rect)
    .resize(BANNER_EXPORT_PX, BANNER_EXPORT_PX, { fit: "fill" })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

async function loadShopImage(url: string): Promise<Buffer | null> {
  if (!isShopImageUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(renderSourceUrl(url), {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > MAX_IMAGE_BYTES) return null;
    return bytes;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await fn(items[index]!, index);
      }
    },
  );
  await Promise.all(workers);
}

type ZipEntry = { name: string; data: Buffer };

function dosStamp(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      (date.getUTCSeconds() >> 1),
    date:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
  };
}

type CentralEntry = {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
};

/**
 * Stored (uncompressed) zip written one file at a time. JPEGs are already
 * compressed, and each file leaves memory once its local header is emitted.
 */
export function createZipWriter(at = new Date()) {
  const stamp = dosStamp(at);
  const centrals: CentralEntry[] = [];
  let offset = 0;

  const push = (name: string, data: Buffer): Buffer => {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    centrals.push({ name: nameBuf, crc, size: data.length, offset });
    offset += local.length + nameBuf.length + data.length;
    return Buffer.concat([local, nameBuf, data]);
  };

  const finish = (): Buffer => {
    const parts: Buffer[] = [];
    const centralStart = offset;
    for (const entry of centrals) {
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(stamp.time, 12);
      central.writeUInt16LE(stamp.date, 14);
      central.writeUInt32LE(entry.crc, 16);
      central.writeUInt32LE(entry.size, 20);
      central.writeUInt32LE(entry.size, 24);
      central.writeUInt16LE(entry.name.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(entry.offset, 42);
      parts.push(central, entry.name);
      offset += central.length + entry.name.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(centrals.length, 8);
    end.writeUInt16LE(centrals.length, 10);
    end.writeUInt32LE(offset - centralStart, 12);
    end.writeUInt32LE(centralStart, 16);
    end.writeUInt16LE(0, 20);
    parts.push(end);
    return Buffer.concat(parts);
  };

  return { push, finish };
}

/** Stored (uncompressed) zip. The jpegs are already compressed. */
export function zipStored(entries: ZipEntry[], at = new Date()): Buffer {
  const writer = createZipWriter(at);
  const parts = entries.map((entry) => writer.push(entry.name, entry.data));
  parts.push(writer.finish());
  return Buffer.concat(parts);
}

type ExportJob = {
  product: BannerProduct;
  handle: string;
  stem: string;
};

async function renderJob(
  job: ExportJob,
  loadImage: (url: string) => Promise<Buffer | null>,
): Promise<{ row: BannerExportRow; jpeg: Buffer | null }> {
  const row: BannerExportRow = {
    title: job.product.name ?? "",
    handle: job.handle,
    product_url: cleanProductUrl(job.product.url ?? ""),
    pitch: job.product.pitch ?? "",
    image_file: "",
    original_image_url: job.product.image ?? "",
    note: "",
  };
  if (!job.product.frame) {
    row.note = "no saved frame";
    return { row, jpeg: null };
  }
  const source = (job.product.image ?? "").trim();
  if (!source || !isShopImageUrl(source)) {
    row.note = "could not read the photo";
    return { row, jpeg: null };
  }
  const bytes = await loadImage(source);
  if (!bytes) {
    row.note = "could not read the photo";
    return { row, jpeg: null };
  }
  try {
    const jpeg = await renderBannerSquare(bytes, job.product.frame);
    row.image_file = `${job.stem}.jpg`;
    return { row, jpeg };
  } catch {
    row.note = "could not apply the frame";
    return { row, jpeg: null };
  }
}

/**
 * One row per pick. A saved frame becomes a 1080 JPEG named for the handle.
 * No saved frame, or a photo we cannot read, stays in the CSV with a note
 * and no file so one bad product does not fail the download.
 *
 * Files are handed to `emit` as each square finishes. The caller writes them
 * into the zip and can drop the bytes. manifest.csv is emitted last.
 */
export async function runBannerExport(
  products: BannerProduct[],
  emit: (name: string, data: Buffer) => void,
  loadImage: (url: string) => Promise<Buffer | null> = loadShopImage,
): Promise<BannerExportRow[]> {
  const used = new Set<string>();
  const planned = products.map((product, index) => {
    const handle = (product.handle ?? "").trim() || `product-${index + 1}`;
    const stem = uniqueStem(bannerExportStem(handle), used);
    return { product, handle, stem };
  });

  const rows = new Array<BannerExportRow>(planned.length);
  let writeChain = Promise.resolve();
  const emitSerial = (name: string, data: Buffer) => {
    writeChain = writeChain.then(() => {
      emit(name, data);
    });
  };

  await mapPool(planned, RENDER_CONCURRENCY, async (job, index) => {
    const rendered = await renderJob(job, loadImage);
    rows[index] = rendered.row;
    if (rendered.jpeg && rendered.row.image_file) {
      emitSerial(rendered.row.image_file, rendered.jpeg);
    }
  });
  await writeChain;
  emit(
    "manifest.csv",
    Buffer.from(bannerExportCsv(rows), "utf8"),
  );
  return rows;
}

export async function buildBannerExport(
  products: BannerProduct[],
  loadImage: (url: string) => Promise<Buffer | null> = loadShopImage,
): Promise<{ zip: Buffer; rows: BannerExportRow[] }> {
  const writer = createZipWriter();
  const parts: Buffer[] = [];
  const rows = await runBannerExport(
    products,
    (name, data) => {
      parts.push(writer.push(name, data));
    },
    loadImage,
  );
  parts.push(writer.finish());
  return { zip: Buffer.concat(parts), rows };
}

/** Streams the zip as each square finishes, instead of buffering the catalog. */
export function openBannerExport(
  products: BannerProduct[],
  loadImage: (url: string) => Promise<Buffer | null> = loadShopImage,
): ReadableStream<Uint8Array> {
  const writer = createZipWriter();
  return new ReadableStream({
    async start(controller) {
      try {
        await runBannerExport(products, (name, data) => {
          controller.enqueue(new Uint8Array(writer.push(name, data)));
        }, loadImage);
        controller.enqueue(new Uint8Array(writer.finish()));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
