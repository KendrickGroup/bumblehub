"use client";

import { useEffect } from "react";
import { isRadioHostName } from "@/lib/radio/host";

export function RadioPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    if (isRadioHostName(window.location.host)) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
      return;
    }
    void navigator.serviceWorker.register("/radio/sw.js", { scope: "/radio" });
  }, []);
  return null;
}
