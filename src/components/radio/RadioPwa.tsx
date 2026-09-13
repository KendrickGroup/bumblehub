"use client";

import { useEffect } from "react";

export function RadioPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/radio/sw.js", { scope: "/radio" });
  }, []);
  return null;
}
