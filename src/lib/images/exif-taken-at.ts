import exifr from "exifr";

/**
 * Read capture time from EXIF before any canvas re-encode (which strips metadata).
 * Prefers DateTimeOriginal, then CreateDate / DateTimeDigitized.
 */
export async function readTakenAtFromImage(
  file: Blob,
): Promise<string | null> {
  try {
    const data = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
    });
    if (!data) return null;

    const raw =
      data.DateTimeOriginal ?? data.CreateDate ?? data.DateTimeDigitized;
    if (!raw) return null;

    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}
