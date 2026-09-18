import { sniffChartArtType } from "@/lib/radio/chart-art";
import { BANNER_PRODUCT_STORE_PX } from "@/lib/radio/banner";

export type PreparedBannerProduct = {
  blob: Blob;
  filename: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  ext: "png" | "jpg" | "webp";
};

export async function prepareBannerProductUpload(
  file: File,
): Promise<PreparedBannerProduct> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffChartArtType(head, file.type);
  if (!kind) {
    throw new Error("Use a PNG, JPEG, or WebP image.");
  }

  const prepared = (blob: Blob): PreparedBannerProduct => ({
    blob,
    filename: `banner.${kind.ext}`,
    contentType: kind.contentType,
    ext: kind.ext,
  });

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image could not be decoded.");
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < 1) {
      throw new Error("That image could not be decoded.");
    }
    const alreadySquare = bitmap.width === bitmap.height;
    const out = Math.min(side, BANNER_PRODUCT_STORE_PX);
    if (alreadySquare && side <= BANNER_PRODUCT_STORE_PX) {
      return prepared(file);
    }

    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d", {
      alpha: kind.contentType !== "image/jpeg",
    });
    if (!ctx) {
      throw new Error("Could not process image");
    }
    ctx.clearRect(0, 0, out, out);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) =>
          next ? resolve(next) : reject(new Error("Could not encode image")),
        kind.contentType,
        kind.contentType === "image/jpeg" ? 0.92 : undefined,
      );
    });
    return prepared(blob);
  } finally {
    bitmap.close();
  }
}
