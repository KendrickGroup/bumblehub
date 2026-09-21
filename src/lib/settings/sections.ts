export const SETTINGS_WIDE_MQ = "(min-width: 768px)";

export type SettingsSectionId = "radio" | "latigo" | "cabin" | "system";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
  detail: string;
  href: `/settings/${SettingsSectionId}`;
  icon: SettingsSectionId;
};

/**
 * Single source for both the phone index and the wide sidebar.
 * Adding a fifth section is one entry here, not a layout rewrite.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "radio",
    label: "Radio",
    description: "Stations, bands, chart art",
    detail: "Everything the dial plays and everything it shows.",
    href: "/settings/radio",
    icon: "radio",
  },
  {
    id: "latigo",
    label: "Latigo",
    description: "Banner, list, playlist",
    detail: "The strap, the list, and the playlist the ranch keeps.",
    href: "/settings/latigo",
    icon: "latigo",
  },
  {
    id: "cabin",
    label: "Cabin",
    description: "Tiles, scenes, vitals",
    detail: "What the house screen shows and what a tap does.",
    href: "/settings/cabin",
    icon: "cabin",
  },
  {
    id: "system",
    label: "System",
    description: "Build, flags, keys",
    detail: "Build, flags, keys, and the rest of the hive.",
    href: "/settings/system",
    icon: "system",
  },
];

export function settingsSectionByPath(
  pathname: string,
): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.href === pathname);
}
