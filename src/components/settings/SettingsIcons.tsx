import type { SettingsSectionId } from "@/lib/settings/sections";

export function SettingsSectionIcon({
  id,
}: {
  id: SettingsSectionId;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      {id === "radio" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      ) : null}
      {id === "latigo" ? (
        <>
          <path d="M4 9h16v10H4z" />
          <path d="M9 9V6h6v3" />
        </>
      ) : null}
      {id === "cabin" ? (
        <>
          <path d="M4 11l8-6 8 6" />
          <path d="M6 11v8h12v-8" />
        </>
      ) : null}
      {id === "system" ? (
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
        </>
      ) : null}
    </svg>
  );
}
