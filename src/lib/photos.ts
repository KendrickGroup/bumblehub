export const GUESTBOOK_BUCKET = "guestbook";

export function guestbookStoragePath(propertyId: string, photoId: string): string {
  return `${propertyId}/${photoId}.jpg`;
}
