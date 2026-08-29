import { createServiceClient } from "@/lib/supabase/server";
import type { Device, Room, Scene, SceneAction } from "@/lib/types";

export async function listRooms(propertyId: string): Promise<Room[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("rooms")
    .select("id, property_id, name, display_order, icon")
    .eq("property_id", propertyId)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Room[];
}

export async function listDevices(propertyId: string): Promise<Device[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("devices")
    .select(
      "id, property_id, room_id, name, device_type, protocol, external_id, capabilities, metadata, is_active, display_order",
    )
    .eq("property_id", propertyId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Device[];
}

export async function listScenes(propertyId: string): Promise<Scene[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("scenes")
    .select(
      "id, property_id, name, description, icon, accent_color, display_order, is_favorite",
    )
    .eq("property_id", propertyId)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Scene[];
}

export async function listSceneActions(
  sceneIds: string[],
): Promise<SceneAction[]> {
  if (sceneIds.length === 0) return [];
  const service = createServiceClient();
  const { data, error } = await service
    .from("scene_actions")
    .select(
      "id, scene_id, action_type, device_id, payload, delay_seconds, display_order",
    )
    .in("scene_id", sceneIds)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SceneAction[];
}
