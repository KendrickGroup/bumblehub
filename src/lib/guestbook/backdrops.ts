export type BuiltinBackdrop = {
  id: string;
  label: string;
  url: string;
  builtin: true;
};

export type CustomBackdrop = {
  id: string;
  label: string;
  url: string;
  builtin: false;
};

export type GuestbookBackdrop = BuiltinBackdrop | CustomBackdrop;

export const BUILTIN_BACKDROPS: BuiltinBackdrop[] = [
  {
    id: "honey-gradient",
    label: "Honey",
    url: "/backdrops/honey-gradient.svg",
    builtin: true,
  },
  {
    id: "night-sky",
    label: "Night sky",
    url: "/backdrops/night-sky.svg",
    builtin: true,
  },
  {
    id: "cozy-cabin",
    label: "Cozy cabin",
    url: "/backdrops/cozy-cabin.svg",
    builtin: true,
  },
  {
    id: "golden-field",
    label: "Golden field",
    url: "/backdrops/golden-field.svg",
    builtin: true,
  },
];

export function parseCustomBackdrops(
  dashboardLayout: unknown,
): CustomBackdrop[] {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return [];
  const raw = (dashboardLayout as Record<string, unknown>).guestbook_backdrops;
  if (!Array.isArray(raw)) return [];

  const out: CustomBackdrop[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || !row.url) continue;
    const id =
      typeof row.id === "string" && row.id
        ? row.id
        : `custom-${out.length + 1}`;
    const label =
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim().slice(0, 40)
        : "Custom";
    out.push({ id, label, url: row.url, builtin: false });
  }
  return out.slice(0, 6);
}
