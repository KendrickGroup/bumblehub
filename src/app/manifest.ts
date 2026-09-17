import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isRadioHostName } from "@/lib/radio/host";
import { latigoRadioManifest } from "@/lib/radio/manifest";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  if (isRadioHostName(host)) {
    return latigoRadioManifest(true);
  }
  return {
    name: "BumbleHub",
    short_name: "BumbleHub",
    description: "Touch-first smart home dashboard",
    start_url: "/home",
    display: "standalone",
    background_color: "#FAF8F3",
    theme_color: "#F4B400",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
