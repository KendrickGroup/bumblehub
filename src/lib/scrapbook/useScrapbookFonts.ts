"use client";

import { useEffect } from "react";

/**
 * Load scrapbook display fonts once when the scrapbook route mounts.
 * Fraunces is already on the app shell.
 */
export function useScrapbookFonts() {
  useEffect(() => {
    const id = "scrapbook-google-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Permanent+Marker&family=Special+Elite&display=swap";
    document.head.appendChild(link);
  }, []);
}
