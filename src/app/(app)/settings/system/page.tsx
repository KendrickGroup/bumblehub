import type { Metadata } from "next";
import { settingsSession, tryServiceClient } from "@/lib/settings/session";
import {
  fetchGuestbookPhotos,
  isPropertyOwner,
} from "@/lib/photos";
import {
  DEFAULT_IDLE_DRIFT_SETTINGS,
  parseIdleDriftSettings,
} from "@/lib/idle/settings";
import {
  DEFAULT_SLIDESHOW_STYLE,
  parseSlideshowStyle,
} from "@/lib/hive/slideshow-style";
import { parseHomeAssistantUrl } from "@/lib/integrations/home-assistant";
import { parseCustomBackdrops } from "@/lib/guestbook/backdrops";
import { isSpotifyConnected } from "@/lib/spotify/tokens";
import { isHomeAssistantConnected } from "@/lib/home-assistant/tokens";
import { BUILD_SHA, BUILD_TIME_ISO, formatBuiltLabel } from "@/lib/build-info";
import { listEnvPresence } from "@/lib/settings/env-presence";
import { IdleDriftSettingsPanel } from "../IdleDriftSettingsPanel";
import { IntegrationsSettingsPanel } from "../IntegrationsSettingsPanel";
import { PhotoBoothSettingsSection } from "../PhotoBoothSettingsSection";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";

export const metadata: Metadata = {
  title: "System · Settings",
};

function ComingSoonRow({ title }: { title: string }) {
  return (
    <SettingsRow title={title} value="Coming soon" />
  );
}

export default async function SystemSettingsPage() {
  const { supabase, user, propertyId } = await settingsSession();

  let idleSettings = DEFAULT_IDLE_DRIFT_SETTINGS;
  let slideshowStyle = DEFAULT_SLIDESHOW_STYLE;
  let isOwner = false;
  let homeAssistantUrl = "";
  let homeAssistantHasToken = false;
  let customBackdrops = parseCustomBackdrops(null);
  let photos: Awaited<ReturnType<typeof fetchGuestbookPhotos>> = [];
  let spotify = {
    connected: false,
    displayName: null as string | null,
    lastSyncedAt: null as string | null,
  };

  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    idleSettings = parseIdleDriftSettings(data?.dashboard_layout);
    slideshowStyle = parseSlideshowStyle(data?.dashboard_layout);
    homeAssistantUrl = parseHomeAssistantUrl(data?.dashboard_layout);
    customBackdrops = parseCustomBackdrops(data?.dashboard_layout);
    isOwner = user ? await isPropertyOwner(propertyId, user.id) : false;
    photos = await fetchGuestbookPhotos(propertyId);

    try {
      const connected = await isSpotifyConnected(propertyId);
      const service = tryServiceClient();
      if (service) {
        const { data: row } = await service
          .from("integrations")
          .select("display_name, last_synced_at")
          .eq("property_id", propertyId)
          .eq("integration_type", "spotify")
          .maybeSingle();
        spotify = {
          connected,
          displayName: row?.display_name ?? "Spotify",
          lastSyncedAt: row?.last_synced_at ?? null,
        };
      } else {
        spotify = {
          connected,
          displayName: "Spotify",
          lastSyncedAt: null,
        };
      }
    } catch {
      // Service role missing in some envs — leave disconnected.
    }

    try {
      homeAssistantHasToken = await isHomeAssistantConnected(propertyId);
    } catch {
      // leave false
    }
  }

  const env = listEnvPresence();
  const built = formatBuiltLabel(BUILD_TIME_ISO);

  return (
    <>
      <SettingsGroup title="BUILD">
        <SettingsRow title="Stamp" value={BUILD_SHA} />
        <SettingsRow
          title="Built"
          value={built ?? (BUILD_TIME_ISO || "dev")}
        />
      </SettingsGroup>

      <SettingsGroup title="KEYS">
        {env.map((item) => (
          <SettingsRow
            key={item.key}
            title={item.label}
            hint={item.key}
            value={item.present ? "Set" : "Not set"}
            needed={item.required && !item.present}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="FEATURE FLAGS">
        <SettingsRow
          title="Flags"
          hint="No runtime flags are wired yet"
          value="None"
        />
      </SettingsGroup>

      <section className="settings-account">
        <h4>ACCOUNT</h4>
        <div className="settings-row">
          <span className="settings-lab">
            <b>Signed in</b>
            <span>{user?.email ?? "—"}</span>
          </span>
        </div>
        <form action="/auth/signout" method="post" className="settings-signout">
          <button type="submit">Sign out</button>
        </form>
      </section>

      <div className="settings-stack">
        <IntegrationsSettingsPanel
          hasProperty={!!propertyId}
          initialHomeAssistantUrl={homeAssistantUrl}
          initialHasToken={homeAssistantHasToken}
          initialSpotify={spotify}
        />
        <IdleDriftSettingsPanel
          initialSettings={idleSettings}
          hasProperty={!!propertyId}
        />
        <PhotoBoothSettingsSection
          hasProperty={!!propertyId}
          initialPhotos={photos}
          canDelete={isOwner}
          initialSlideshowStyle={slideshowStyle}
          initialBackdrops={customBackdrops}
        />
      </div>

      <SettingsGroup title="MORE">
        <ComingSoonRow title="Themes" />
        <ComingSoonRow title="Property" />
      </SettingsGroup>

      <SettingsGroup
        title="DANGER ZONE"
        hint="Sign out above. House Mode PIN clear lives under Cabin."
      >
        <SettingsRow
          title="House PIN"
          hint="Clear it from Cabin → House Mode"
          href="/settings/cabin"
        />
      </SettingsGroup>
    </>
  );
}
