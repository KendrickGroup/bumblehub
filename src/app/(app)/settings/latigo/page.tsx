import type { Metadata } from "next";
import { settingsSession } from "@/lib/settings/session";
import { BANNER_ROTATE_DEFAULT_SEC, ensureBannerLines } from "@/lib/radio/banner";
import { PUBLIC_ROUNDUP_PLAYLIST_URL } from "@/lib/radio/ranch";
import { BannerProductsPanel } from "../BannerProductsPanel";
import { BannerRotateField } from "@/components/settings/BannerRotateField";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";

export const metadata: Metadata = {
  title: "Latigo · Settings",
};

export default async function LatigoSettingsPage() {
  const { supabase, propertyId } = await settingsSession();
  let bannerProducts: Awaited<ReturnType<typeof ensureBannerLines>>["products"] =
    [];
  let bannerLines: string[] = [];
  let rotateSeconds = BANNER_ROTATE_DEFAULT_SEC;

  if (propertyId) {
    const banner = await ensureBannerLines(supabase, propertyId);
    bannerProducts = banner.products;
    bannerLines = banner.lines;
    rotateSeconds = banner.rotateSeconds;
  }

  const playlist = PUBLIC_ROUNDUP_PLAYLIST_URL;
  const playlistHint = playlist || "Not set";

  return (
    <>
      <SettingsGroup title="BANNER">
        <BannerRotateField
          hasProperty={!!propertyId}
          initialSeconds={rotateSeconds}
        />
      </SettingsGroup>

      <BannerProductsPanel
        initialProducts={bannerProducts}
        initialLines={bannerLines}
      />

      <SettingsGroup title="SPOTIFY">
        <SettingsRow
          title="Roundup playlist"
          hint={playlistHint}
          needed={!playlist}
        />
      </SettingsGroup>
    </>
  );
}
