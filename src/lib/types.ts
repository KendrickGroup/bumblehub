export type Property = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type Scene = {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  accent_color: string | null;
  display_order: number;
  is_favorite: boolean;
};

export type Room = {
  id: string;
  property_id: string;
  name: string;
  display_order: number;
  icon: string | null;
};

export type DeviceType =
  | "light"
  | "switch"
  | "plug"
  | "thermostat"
  | "camera"
  | "lock"
  | "sensor"
  | "speaker"
  | "tv"
  | "other";

export type Device = {
  id: string;
  property_id: string;
  room_id: string | null;
  name: string;
  device_type: DeviceType;
  protocol: string;
  external_id: string | null;
  capabilities: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_active: boolean;
  display_order: number;
};

export type SceneActionType =
  | "set_device_state"
  | "play_spotify_playlist"
  | "pause_music"
  | "set_thermostat"
  | "send_notification"
  | "speak_text"
  | "launch_tv_view";

/** Stored on scene_actions.payload for set_device_state. */
export type DeviceActionPayload = {
  entity_id: string;
  service: "turn_on" | "turn_off";
  data?: { brightness_pct?: number };
};

export type SceneAction = {
  id: string;
  scene_id: string;
  action_type: SceneActionType;
  device_id: string | null;
  payload: Record<string, unknown>;
  delay_seconds: number;
  display_order: number;
};

export type Photo = {
  id: string;
  property_id: string | null;
  url: string;
  caption: string | null;
  taken_at: string | null;
  category: string | null;
  is_curated: boolean;
  created_by: string | null;
  created_at: string;
  share_token?: string | null;
  watermarked_url?: string | null;
};
