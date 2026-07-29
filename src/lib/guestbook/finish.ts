export type PortraitFinish = "color" | "sepia" | "tintype";

export const FINISH_LABELS: Record<PortraitFinish, string> = {
  color: "Color",
  sepia: "Sepia",
  tintype: "Tintype",
};

/** CSS filter strings for live preview and matching canvas filters. */
export const FINISH_CSS: Record<PortraitFinish, string> = {
  color: "none",
  sepia: "sepia(0.68) contrast(1.06) saturate(0.9)",
  tintype: "grayscale(1) contrast(1.12) brightness(0.96)",
};

export function applyFinishToBlob(
  source: HTMLImageElement | HTMLCanvasElement,
  finish: PortraitFinish,
  quality = 0.92,
): Promise<Blob | null> {
  const width =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) return Promise.resolve(null);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  ctx.filter = FINISH_CSS[finish];
  ctx.drawImage(source, 0, 0, width, height);
  ctx.filter = "none";

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}
