import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import {
  DEFAULT_IDLE_DRIFT_SETTINGS,
  parseIdleDriftSettings,
} from "@/lib/idle/settings";
import {
  DEFAULT_SLIDESHOW_STYLE,
  parseSlideshowStyle,
} from "@/lib/hive/slideshow-style";
import {
  DEFAULT_HOUSE_GREETING,
  parseHouseModeSettings,
} from "@/lib/house-mode/settings";
import { parseHomeAssistantUrl } from "@/lib/integrations/home-assistant";
import { isSpotifyConnected } from "@/lib/spotify/tokens";
import { SettingsGate } from "@/components/house-mode/SettingsGate";
import { HouseModeSettingsPanel } from "@/components/house-mode/HouseModeSettingsPanel";
import { AppBrandLockup } from "@/components/brand/AppBrandLockup";
import { IdleDriftSettingsPanel } from "./IdleDriftSettingsPanel";
import { IntegrationsSettingsPanel } from "./IntegrationsSettingsPanel";

export const metadata: Metadata = {
  title: "Settings",
};

function ComingSoonRow({ title }: { title: string }) {
  return (
    <div className="flex min-h-[64px] items-center justify-between rounded-[18px] border border-stone-100 bg-[#FAF8F3] px-5">
      <span className="text-base font-medium text-stone-800">{title}</span>
      <span className="text-sm text-stone-500">Coming soon</span>
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  let idleSettings = DEFAULT_IDLE_DRIFT_SETTINGS;
  let slideshowStyle = DEFAULT_SLIDESHOW_STYLE;
  let houseGreeting = DEFAULT_HOUSE_GREETING;
  let hasPin = false;
  let propertyName: string | null = null;
  let isOwner = false;
  let homeAssistantUrl = "";
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
    const house = parseHouseModeSettings(data?.dashboard_layout);
    houseGreeting = house.greeting;
    hasPin = Boolean(house.pinHash);
    homeAssistantUrl = parseHomeAssistantUrl(data?.dashboard_layout);
    isOwner = user ? await isPropertyOwner(propertyId, user.id) : false;

    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();
    propertyName = property?.name ?? null;

    try {
      const connected = await isSpotifyConnected(propertyId);
      const service = createServiceClient();
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
    } catch {
      // Service role missing in some envs — leave disconnected.
    }
  }

  return (
    <SettingsGate>
      <div className="px-2 py-6 sm:px-0">
        <AppBrandLockup />
        <h1
          className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          Settings
        </h1>

        <section className="mt-8 rounded-[20px] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
            Account
          </h2>
          <p className="mt-3 text-base text-stone-800">{user?.email}</p>
          <form action="/auth/signout" method="post" className="mt-6">
            <button
              type="submit"
              className="min-h-[56px] w-full rounded-[18px] border border-stone-200 bg-white text-base font-semibold text-stone-800 transition hover:bg-stone-50 sm:w-auto sm:px-8"
            >
              Sign out
            </button>
          </form>
        </section>

        <div className="mt-6">
          <HouseModeSettingsPanel
            initial={{
              hasProperty: !!propertyId,
              hasPin,
              greeting: houseGreeting,
              propertyName,
              isOwner,
            }}
          />
        </div>

        <div className="mt-6">
          <IdleDriftSettingsPanel
            initialSettings={idleSettings}
            initialSlideshowStyle={slideshowStyle}
            hasProperty={!!propertyId}
          />
        </div>

        <div className="mt-6">
          <IntegrationsSettingsPanel
            hasProperty={!!propertyId}
            initialHomeAssistantUrl={homeAssistantUrl}
            initialSpotify={spotify}
          />
        </div>

        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
            More
          </h2>
          <ComingSoonRow title="Themes" />
          <ComingSoonRow title="Property" />
        </section>
      </div>
    </SettingsGate>
  );
}
