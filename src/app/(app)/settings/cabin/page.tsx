import type { Metadata } from "next";
import { settingsSession, tryServiceClient } from "@/lib/settings/session";
import { isPropertyOwner } from "@/lib/photos";
import {
  DEFAULT_HOUSE_GREETING,
  parseHouseModeSettings,
} from "@/lib/house-mode/settings";
import { parseVitalsConfig } from "@/lib/home/vitals";
import {
  listDevices,
  listRooms,
  listSceneActions,
  listScenes,
} from "@/lib/home-assistant/queries";
import { HouseModeSettingsPanel } from "@/components/house-mode/HouseModeSettingsPanel";
import { HomeScenesPanel } from "../HomeScenesPanel";
import { VitalsSettingsPanel } from "../VitalsSettingsPanel";
import { DevicesSettingsPanel } from "../DevicesSettingsPanel";
import { ScenesSettingsPanel } from "../ScenesSettingsPanel";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";
import type { Device, Room, Scene, SceneAction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cabin · Settings",
};

export default async function CabinSettingsPage() {
  const { supabase, user, propertyId } = await settingsSession();

  let houseGreeting = DEFAULT_HOUSE_GREETING;
  let vitalsConfig = parseVitalsConfig(null);
  let hasPin = false;
  let propertyName: string | null = null;
  let isOwner = false;
  let devices: Device[] = [];
  let rooms: Room[] = [];
  let scenes: Scene[] = [];
  let sceneActions: SceneAction[] = [];

  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    vitalsConfig = parseVitalsConfig(data?.dashboard_layout);
    const house = parseHouseModeSettings(data?.dashboard_layout);
    houseGreeting = house.greeting;
    hasPin = Boolean(house.pinHash);
    isOwner = user ? await isPropertyOwner(propertyId, user.id) : false;

    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();
    propertyName = property?.name ?? null;

    try {
      if (tryServiceClient()) {
        devices = await listDevices(propertyId);
        rooms = await listRooms(propertyId);
        scenes = await listScenes(propertyId);
        sceneActions = await listSceneActions(scenes.map((s) => s.id));
      }
    } catch {
      // Service role missing — devices/scenes panels stay empty.
    }
  }

  return (
    <>
      <SettingsGroup title="CABIN INFO">
        <SettingsRow
          title="Wi-Fi & house guide"
          hint="Network, password, and guest notes"
          href="/info"
        />
      </SettingsGroup>

      <div className="settings-stack">
        <HouseModeSettingsPanel
          initial={{
            hasProperty: !!propertyId,
            hasPin,
            greeting: houseGreeting,
            propertyName,
            isOwner,
          }}
        />
        <HomeScenesPanel
          hasProperty={!!propertyId}
          initialScenes={scenes}
        />
        <VitalsSettingsPanel
          hasProperty={!!propertyId}
          initialConfig={vitalsConfig}
          devices={devices}
        />
        <DevicesSettingsPanel
          hasProperty={!!propertyId}
          initialDevices={devices}
          initialRooms={rooms}
        />
        <ScenesSettingsPanel
          hasProperty={!!propertyId}
          initialScenes={scenes}
          initialActions={sceneActions}
          initialDevices={devices}
        />
      </div>
    </>
  );
}
