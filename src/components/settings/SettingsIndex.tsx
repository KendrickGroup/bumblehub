"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SETTINGS_SECTIONS, SETTINGS_WIDE_MQ } from "@/lib/settings/sections";
import { SettingsNav } from "./SettingsNav";

export function SettingsIndex() {
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia(SETTINGS_WIDE_MQ);
    const go = () => {
      if (mq.matches) {
        router.replace(SETTINGS_SECTIONS[0]!.href);
      }
    };
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [router]);

  return (
    <div className="settings-index">
      <SettingsNav withChevrons />
    </div>
  );
}
