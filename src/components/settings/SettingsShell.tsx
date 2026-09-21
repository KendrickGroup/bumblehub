"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SETTINGS_SECTIONS,
  settingsSectionByPath,
} from "@/lib/settings/sections";
import { SettingsNav } from "./SettingsNav";

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = settingsSectionByPath(pathname);
  const isIndex = pathname === "/settings";
  const activeId = section?.id ?? SETTINGS_SECTIONS[0]!.id;

  return (
    <div className="settings-page">
      {isIndex ? (
        <div className="settings-pbar settings-phone-only">Settings</div>
      ) : section ? (
        <div className="settings-pbar settings-phone-only">
          <Link
            href="/settings"
            className="settings-back"
            aria-label="Back to settings"
          >
            <span className="settings-back-chev" />
          </Link>
          {section.label}
        </div>
      ) : null}

      <div className="settings-shell">
        <aside className="settings-side">
          <div className="settings-side-title">Settings</div>
          <SettingsNav activeId={activeId} />
        </aside>
        <div className="settings-detail">
          {section ? (
            <div className="settings-detail-head">
              <h3 className="settings-detail-title">{section.label}</h3>
              <p className="settings-detail-sub">{section.detail}</p>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
