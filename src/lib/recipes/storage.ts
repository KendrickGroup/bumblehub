export const RECIPES_BUCKET = "recipes";

export function recipesStoragePath(propertyId: string, imageId: string): string {
  return `${propertyId}/${imageId}.jpg`;
}

export function storagePathFromRecipeUrl(url: string): string | null {
  const marker = `/object/public/${RECIPES_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]!);
  }
  return null;
}
