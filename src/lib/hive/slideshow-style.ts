export const SLIDESHOW_STYLES = [
  "gallery",
  "corkboard",
  "fridge",
  "memories",
  "reflection",
] as const;
export type SlideshowStyle = (typeof SLIDESHOW_STYLES)[number];

export const DEFAULT_SLIDESHOW_STYLE: SlideshowStyle = "gallery";

export const SLIDESHOW_STYLE_LABELS: Record<SlideshowStyle, string> = {
  gallery: "Gallery",
  corkboard: "Corkboard",
  fridge: "Fridge Door",
  memories: "Memories",
  reflection: "Reflection",
};

/** Legacy saved values that should fall back to Gallery. */
const LEGACY_STYLES = new Set(["honeycomb"]);

export function parseSlideshowStyle(dashboardLayout: unknown): SlideshowStyle {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return DEFAULT_SLIDESHOW_STYLE;
  }

  const raw = (dashboardLayout as Record<string, unknown>).slideshow_style;
  if (typeof raw === "string" && LEGACY_STYLES.has(raw)) {
    return DEFAULT_SLIDESHOW_STYLE;
  }
  if (
    typeof raw === "string" &&
    (SLIDESHOW_STYLES as readonly string[]).includes(raw)
  ) {
    return raw as SlideshowStyle;
  }

  return DEFAULT_SLIDESHOW_STYLE;
}

export function isSlideshowStyle(value: unknown): value is SlideshowStyle {
  return (
    typeof value === "string" &&
    (SLIDESHOW_STYLES as readonly string[]).includes(value)
  );
}
