export type BoothBackdrop = {
  id: string;
  url: string;
  /** Display name. Empty string = unnamed (thumbnail only in the booth). */
  name: string;
};

/** @deprecated Use BoothBackdrop — kept as alias during rename. */
export type CustomBackdrop = BoothBackdrop;

/**
 * Parse `dashboard_layout.guestbook_backdrops`.
 * Accepts `{ id?, url, name }` | `{ id?, url, label }` | bare URL strings.
 * Filenames are never used as names.
 */
export function parseCustomBackdrops(
  dashboardLayout: unknown,
): BoothBackdrop[] {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return [];
  const raw = (dashboardLayout as Record<string, unknown>).guestbook_backdrops;
  if (!Array.isArray(raw)) return [];

  const out: BoothBackdrop[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item) {
      out.push({
        id: `legacy-${out.length + 1}`,
        url: item,
        name: "",
      });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || !row.url) continue;
    const id =
      typeof row.id === "string" && row.id
        ? row.id
        : `custom-${out.length + 1}`;
    let name = "";
    if (typeof row.name === "string") {
      name = row.name.trim().slice(0, 40);
    } else if (typeof row.label === "string") {
      // Legacy field — keep unless it looks like a raw filename.
      const label = row.label.trim().slice(0, 40);
      if (label && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(label)) {
        name = label === "Custom" ? "" : label;
      }
    }
    out.push({ id, url: row.url, name });
  }
  return out.slice(0, 6);
}

export function serializeBackdrops(
  backdrops: BoothBackdrop[],
): { id: string; url: string; name: string }[] {
  return backdrops.map(({ id, url, name }) => ({
    id,
    url,
    name: name.trim().slice(0, 40),
  }));
}
