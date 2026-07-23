export const DEFAULT_MUSIC_EQ_VISIBLE = true;

export function parseMusicEqVisible(dashboardLayout: unknown): boolean {
  if (!dashboardLayout || typeof dashboardLayout !== "object") {
    return DEFAULT_MUSIC_EQ_VISIBLE;
  }

  const layout = dashboardLayout as Record<string, unknown>;
  if (typeof layout.music_eq_visible === "boolean") {
    return layout.music_eq_visible;
  }

  return DEFAULT_MUSIC_EQ_VISIBLE;
}
