import type { Metadata } from "next";
import { settingsSession } from "@/lib/settings/session";
import {
  BANNER_ROTATE_DEFAULT_SEC,
  DEFAULT_BANNER_CARD,
  ensureBannerLines,
} from "@/lib/radio/banner";
import { klaviyoListId } from "@/lib/radio/klaviyo";
import { LATIGO_LIST_ENABLED } from "@/lib/radio/latigo-list";
import { PUBLIC_ROUNDUP_PLAYLIST_URL } from "@/lib/radio/ranch";
import { subscriberCount } from "@/lib/radio/subscriber-count";
import { ShopPicksPanel } from "../ShopPicksPanel";
import { BannerPerformancePanel } from "@/components/settings/AnalyticsPanels";
import { BannerRotateField } from "@/components/settings/BannerRotateField";
import { ExpandCardFields } from "@/components/settings/ExpandCardFields";
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

  const subscribers = await subscriberCount();
  const listId = klaviyoListId();
  const keySet = Boolean((process.env.KLAVIYO_PRIVATE_KEY ?? "").trim());
  const subscriberHint = !subscribers.available
    ? "Count unavailable"
    : subscribers.total === subscribers.synced
      ? "All synced to Klaviyo"
      : `${subscribers.total - subscribers.synced} waiting on Klaviyo`;

  return (
    <>
      <SettingsGroup title="BANNER">
        <BannerRotateField
          hasProperty={!!propertyId}
          initialSeconds={banner?.rotateSeconds ?? BANNER_ROTATE_DEFAULT_SEC}
        />
      </SettingsGroup>

      <SettingsGroup title="PRODUCT CARD">
        <ExpandCardFields
          hasProperty={!!propertyId}
          initial={banner?.card ?? DEFAULT_BANNER_CARD}
        />
      </SettingsGroup>

      <ShopPicksPanel
        hasProperty={!!propertyId}
        initialPicks={banner?.picks ?? []}
        initialUploads={banner?.uploads ?? []}
        initialLines={banner?.lines ?? []}
        initialSource={banner?.source ?? "uploads"}
      />

      <BannerPerformancePanel />

      <SettingsGroup
        title="LATIGO LIST"
        hint={
          LATIGO_LIST_ENABLED
            ? "Listeners are asked to join after 20 minutes of listening, then after every 30 more."
            : "Off. Set NEXT_PUBLIC_LATIGO_LIST_ENABLED to true in Vercel to start asking."
        }
      >
        <SettingsRow
          title="Email gate"
          hint="NEXT_PUBLIC_LATIGO_LIST_ENABLED"
          value={LATIGO_LIST_ENABLED ? "On" : "Off"}
        />
        <SettingsRow
          title="Klaviyo list"
          hint="KLAVIYO_LIST_ID"
          value={listId || undefined}
          needed={!listId}
        />
        <SettingsRow
          title="Klaviyo key"
          hint="KLAVIYO_PRIVATE_KEY"
          value={keySet ? "Set" : undefined}
          needed={!keySet}
        />
        <SettingsRow
          title="Subscribers"
          hint={subscriberHint}
          value={subscribers.available ? String(subscribers.total) : "—"}
        />
      </SettingsGroup>

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
