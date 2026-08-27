export const BUILD_SHA = (
  process.env.NEXT_PUBLIC_BUILD_SHA || "dev"
).trim().slice(0, 7);

export const BUILD_TIME_ISO = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

export function formatBuiltLabel(iso: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(date);
  return `built ${label}`;
}
