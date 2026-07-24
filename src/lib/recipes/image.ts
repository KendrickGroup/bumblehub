/** Downscale an image file client-side (max edge 2560px, JPEG ~0.85). */
export async function downscaleImageFile(
  file: File,
  maxEdge = 2560,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode image"));
      },
      "image/jpeg",
      quality,
    );
  });
}

export function secondsToTimerParts(seconds: number | null): {
  minutes: string;
  seconds: string;
} {
  if (seconds == null || seconds <= 0) {
    return { minutes: "", seconds: "" };
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return { minutes: String(m), seconds: String(s) };
}

export function timerPartsToSeconds(
  minutes: string,
  secs: string,
): number | null {
  const m = minutes.trim() === "" ? 0 : Number(minutes);
  const s = secs.trim() === "" ? 0 : Number(secs);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  const total = Math.round(m) * 60 + Math.round(s);
  return total > 0 ? total : null;
}
