import {
  CHART_ART_MAX_WIDTH,
  sniffChartArtType,
  type ChartArtContentType,
  type ChartArtExt,
} from "@/lib/radio/chart-art";

export type PreparedChartArt = {
  blob: Blob;
  filename: string;
  contentType: ChartArtContentType;
  ext: ChartArtExt;
};

/**
 * Keep uploads lossless unless they are wider than CHART_ART_MAX_WIDTH.
 * PNG stays PNG with alpha; never canvas-to-JPEG.
 */
export async function prepareChartArtUpload(file: File): Promise<PreparedChartArt> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffChartArtType(head, file.type);
  if (!kind) {
    throw new Error("Use a PNG, JPEG, or WebP image.");
  }

  const prepared = (blob: Blob): PreparedChartArt => ({
    blob,
    filename: `chart.${kind.ext}`,
    contentType: kind.contentType,
    ext: kind.ext,
  });

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return prepared(file);
  }

  try {
    if (bitmap.width <= CHART_ART_MAX_WIDTH) {
      return prepared(file);
    }
    const scale = CHART_ART_MAX_WIDTH / bitmap.width;
    const width = CHART_ART_MAX_WIDTH;
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: kind.contentType !== "image/jpeg" });
    if (!ctx) {
      throw new Error("Could not process image");
    }
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error("Could not encode image"))),
        kind.contentType,
        kind.contentType === "image/jpeg" ? 0.92 : undefined,
      );
    });
    return prepared(blob);
  } finally {
    bitmap.close();
  }
}
