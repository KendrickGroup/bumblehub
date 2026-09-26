"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Refresh well inside the access-token hour so a wall iPad is never sent to login. */
const REFRESH_MS = 20 * 60 * 1000;

export function SessionKeepAlive() {
  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      void supabase.auth.getUser().catch(() => {
        // Stay on the current screen. A failed refresh must not navigate.
      });
    };
    const id = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
