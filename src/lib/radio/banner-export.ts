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
const RENDER_CONCURRENCY = 4;

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

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        out[index] = await fn(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return out;
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

/** Stored (uncompressed) zip. The jpegs are already compressed. */
export function zipStored(entries: ZipEntry[], at = new Date()): Buffer {
  const stamp = dosStamp(at);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
}

/**
 * One row per pick. A saved frame becomes a 1080 JPEG named for the handle.
 * No saved frame, or a photo we cannot read, stays in the CSV with a note
 * and no file so one bad product does not fail the download.
 */
export async function buildBannerExport(
  products: BannerProduct[],
  loadImage: (url: string) => Promise<Buffer | null> = loadShopImage,
): Promise<{ zip: Buffer; rows: BannerExportRow[] }> {
  const used = new Set<string>();
  const planned = products.map((product, index) => {
    const handle = (product.handle ?? "").trim() || `product-${index + 1}`;
    const stem = uniqueStem(bannerExportStem(handle), used);
    return { product, handle, stem };
  });

  const rows = await mapPool(planned, RENDER_CONCURRENCY, async (job) => {
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
      return { row, jpeg: null as Buffer | null };
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
  });

  const files: ZipEntry[] = [
    {
      name: "manifest.csv",
      data: Buffer.from(bannerExportCsv(rows.map((item) => item.row)), "utf8"),
    },
  ];
  for (const item of rows) {
    if (item.jpeg && item.row.image_file) {
      files.push({ name: item.row.image_file, data: item.jpeg });
    }
  }
  return { zip: zipStored(files), rows: rows.map((item) => item.row) };
}
