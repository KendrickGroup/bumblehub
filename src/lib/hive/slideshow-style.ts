export const SLIDESHOW_STYLES = ["gallery", "corkboard", "honeycomb"] as const;
export type SlideshowStyle = (typeof SLIDESHOW_STYLES)[number];

export const DEFAULT_SLIDESHOW_STYLE: SlideshowStyle = "gallery";

export const SLIDESHOW_STYLE_LABELS: Record<SlideshowStyle, string> = {
  gallery: "Gallery",
  corkboard: "Corkboard",
  honeycomb: "Honeycomb",
};

export function parseSlideshowStyle(dashboardLayout: unknown): SlideshowStyle {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return DEFAULT_SLIDESHOW_STYLE;
  }

  const raw = (dashboardLayout as Record<string, unknown>).slideshow_style;
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
