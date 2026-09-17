import type { MetadataRoute } from "next";
import { RADIO_OG_DESCRIPTION, RADIO_ORIGIN } from "./host";

export function latigoRadioManifest(
  brandedHost: boolean,
): MetadataRoute.Manifest {
  return {
    name: "Latigo Radio",
    short_name: "Latigo Radio",
    description: RADIO_OG_DESCRIPTION,
    start_url: brandedHost ? "/" : "/radio",
    scope: brandedHost ? "/" : "/radio",
    id: `${RADIO_ORIGIN}/`,
    display: "standalone",
    orientation: "portrait",
    theme_color: "#6B4F36",
    background_color: "#FAF8F3",
    icons: [
      {
        src: "/radio/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/radio/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/radio/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
