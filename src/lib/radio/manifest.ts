import type { MetadataRoute } from "next";
import { RADIO_OG_DESCRIPTION, RADIO_ORIGIN, RADIO_THEME_COLOR } from "./host";

export function latigoRadioManifest(
  brandedHost: boolean,
): MetadataRoute.Manifest {
  return {
    name: "Latigo Radio",
    short_name: "Latigo",
    description: RADIO_OG_DESCRIPTION,
    start_url: brandedHost ? "/" : "/radio",
    scope: brandedHost ? "/" : "/radio",
    id: `${RADIO_ORIGIN}/`,
    display: "standalone",
    orientation: "portrait",
    theme_color: RADIO_THEME_COLOR,
    background_color: RADIO_THEME_COLOR,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
