import { sniffChartArtType } from "@/lib/radio/chart-art";
import {
  BANNER_PRODUCT_MIN_PX,
  BANNER_PRODUCT_STORE_PX,
} from "@/lib/radio/banner";

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

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read that image.");
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < BANNER_PRODUCT_MIN_PX) {
      throw new Error(
        `Use a square photo, ${BANNER_PRODUCT_MIN_PX}px or larger.`,
      );
    }
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = BANNER_PRODUCT_STORE_PX;
    canvas.height = BANNER_PRODUCT_STORE_PX;
    const ctx = canvas.getContext("2d", {
      alpha: kind.contentType !== "image/jpeg",
    });
    if (!ctx) {
      throw new Error("Could not process image");
    }
    ctx.clearRect(0, 0, BANNER_PRODUCT_STORE_PX, BANNER_PRODUCT_STORE_PX);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      sx,
      sy,
      side,
      side,
      0,
      0,
      BANNER_PRODUCT_STORE_PX,
      BANNER_PRODUCT_STORE_PX,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) =>
          next ? resolve(next) : reject(new Error("Could not encode image")),
        kind.contentType,
        kind.contentType === "image/jpeg" ? 0.92 : undefined,
      );
    });
    return {
      blob,
      filename: `banner.${kind.ext}`,
      contentType: kind.contentType,
      ext: kind.ext,
    };
  } finally {
    bitmap.close();
  }
}
