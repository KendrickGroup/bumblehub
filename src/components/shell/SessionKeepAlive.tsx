"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Refresh well inside the access-token hour so a wall iPad is never sent to login. */
const REFRESH_MS = 20 * 60 * 1000;
/** Stay off the first-load path. Arm only after the page is interactive. */
const ARM_AFTER_MS = 2500;

export function SessionKeepAlive() {
  useEffect(() => {
    let intervalId = 0;
    let removeVisible = () => {};
    let cancelled = false;

    const arm = () => {
      if (cancelled) return;
      const supabase = createClient();
      const refresh = () => {
        void supabase.auth.getUser().catch(() => {
          // Stay on the current screen. A failed refresh must not navigate.
        });
      };
      const onVisible = () => {
        if (document.visibilityState === "visible") refresh();
      };
      document.addEventListener("visibilitychange", onVisible);
      removeVisible = () =>
        document.removeEventListener("visibilitychange", onVisible);
      intervalId = window.setInterval(refresh, REFRESH_MS);
    };

    const timer = window.setTimeout(arm, ARM_AFTER_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(intervalId);
      removeVisible();
    };
  }, []);

  return null;
}
