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
import { getCatalogSnapshot } from "@/lib/shopify/catalog-cache";
import { parseShopifyLog, type ShopifyLogEntry } from "@/lib/shopify/log";
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

function clockLabel(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return iso;
  return new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const CATALOG_SOURCE_LABEL: Record<string, string> = {
  "admin-collections": "Best sellers",
  "admin-updated": "Newest (no best-seller data)",
  none: "Nothing came back",
};

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
  let shopifyLog: ShopifyLogEntry[] = [];

  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    shopifyLog = parseShopifyLog(data?.dashboard_layout);
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
  const shop = await getCatalogSnapshot();

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

      <SettingsGroup
        title="SHOPIFY"
        hint="Admin GraphQL API, client credentials grant. Read hourly, never per listener."
      >
        <SettingsRow
          title="Catalog"
          hint={
            shop.ok
              ? CATALOG_SOURCE_LABEL[shop.strategy] ?? shop.strategy
              : (shop.error?.message ?? "Unreachable")
          }
          value={shop.ok ? `${shop.products.length} products` : "Failing"}
          needed={!shop.ok}
        />
        <SettingsRow
          title="Last read"
          hint={shop.stale ? "Serving the last good list" : undefined}
          value={clockLabel(shop.fetchedAt)}
        />
        {shopifyLog.length > 0 ? (
          shopifyLog.map((entry) => (
            <SettingsRow
              key={`${entry.at}-${entry.code}`}
              title={clockLabel(entry.at)}
              hint={entry.message}
              value={entry.code}
            />
          ))
        ) : (
          <SettingsRow title="Fetch failures" value="None" />
        )}
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
