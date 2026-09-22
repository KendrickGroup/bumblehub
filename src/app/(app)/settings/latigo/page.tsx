import type { Metadata } from "next";
import { settingsSession } from "@/lib/settings/session";
import { BANNER_ROTATE_DEFAULT_SEC, ensureBannerLines } from "@/lib/radio/banner";
import { PUBLIC_ROUNDUP_PLAYLIST_URL } from "@/lib/radio/ranch";
import { ShopPicksPanel } from "../ShopPicksPanel";
import { BannerRotateField } from "@/components/settings/BannerRotateField";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";

export const metadata: Metadata = {
  title: "Latigo · Settings",
};

export default async function LatigoSettingsPage() {
  const { supabase, propertyId } = await settingsSession();
  let banner: Awaited<ReturnType<typeof ensureBannerLines>> | null = null;

  if (propertyId) {
    banner = await ensureBannerLines(supabase, propertyId);
  }

  const playlist = PUBLIC_ROUNDUP_PLAYLIST_URL;
  const playlistHint = playlist || "Not set";

  return (
    <>
      <SettingsGroup title="BANNER">
        <BannerRotateField
          hasProperty={!!propertyId}
          initialSeconds={banner?.rotateSeconds ?? BANNER_ROTATE_DEFAULT_SEC}
        />
      </SettingsGroup>

      <ShopPicksPanel
        hasProperty={!!propertyId}
        initialPicks={banner?.picks ?? []}
        initialUploads={banner?.uploads ?? []}
        initialLines={banner?.lines ?? []}
        initialSource={banner?.source ?? "uploads"}
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
