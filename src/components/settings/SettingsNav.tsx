"use client";

import Link from "next/link";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/lib/settings/sections";
import { SettingsSectionIcon } from "./SettingsIcons";

export function SettingsNav({
  activeId,
  withChevrons,
}: {
  activeId?: SettingsSectionId;
  withChevrons?: boolean;
}) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map((section) => {
        const on = activeId === section.id;
        return (
          <Link
            key={section.id}
            href={section.href}
            className={`settings-navitem${on ? " on" : ""}`}
            aria-current={on ? "page" : undefined}
          >
            <span className="settings-ic">
              <SettingsSectionIcon id={section.icon} />
            </span>
            <span className="settings-tx">
              <b>{section.label}</b>
              <span>{section.description}</span>
            </span>
            {withChevrons ? (
              <span className="settings-chev" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
