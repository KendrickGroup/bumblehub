import type { DeviceType } from "@/lib/types";
import {
  entityDomain,
  isSwitchOrLightEntity,
  macFromConnections,
  type HaDeviceRegistryInfo,
  type HaState,
} from "./client";

export type HaDeviceSyncItem = {
  external_id: string;
  name: string;
  device_type: DeviceType;
  capabilities: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

function friendlyName(state: HaState): string {
  const raw = state.attributes.friendly_name;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const id = state.entity_id.split(".")[1] ?? state.entity_id;
  return id.replace(/_/g, " ");
}

function deviceTypeFor(state: HaState): DeviceType {
  const domain = entityDomain(state.entity_id);
  if (domain === "light") return "light";
  const deviceClass = String(state.attributes.device_class ?? "").toLowerCase();
  if (deviceClass === "outlet" || deviceClass === "plug") return "plug";
  return "switch";
}

function supportsBrightness(state: HaState): boolean {
  if (!state.entity_id.startsWith("light.")) return false;
  if (typeof state.attributes.brightness === "number") return true;
  const modes = state.attributes.supported_color_modes;
  if (Array.isArray(modes)) {
    return modes.some(
      (m) =>
        m === "brightness" ||
        m === "hs" ||
        m === "xy" ||
        m === "rgb" ||
        m === "rgbw" ||
        m === "rgbww" ||
        m === "color_temp" ||
        m === "white",
    );
  }
  const features = state.attributes.supported_features;
  return typeof features === "number" && features > 0;
}

export function statesToSyncItems(
  states: HaState[],
  registry: Map<string, HaDeviceRegistryInfo>,
): HaDeviceSyncItem[] {
  const items: HaDeviceSyncItem[] = [];

  for (const state of states) {
    if (!isSwitchOrLightEntity(state.entity_id)) continue;
    const info = registry.get(state.entity_id);
    const mac = macFromConnections(info?.connections);
    items.push({
      external_id: state.entity_id,
      name: friendlyName(state),
      device_type: deviceTypeFor(state),
      capabilities: {
        domain: entityDomain(state.entity_id),
        supports_brightness: supportsBrightness(state),
      },
      metadata: {
        ha_entity_id: state.entity_id,
        ha_device_id: info?.device_id ?? null,
        mac,
        identifiers: info?.identifiers ?? null,
        manufacturer: info?.manufacturer ?? null,
        model: info?.model ?? null,
        ha_state: state.state,
      },
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}
