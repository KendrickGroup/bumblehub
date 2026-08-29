import { createServiceClient } from "@/lib/supabase/server";
import {
  parseHomeAssistantCredentials,
  type HomeAssistantCredentials,
} from "./credentials";

export class HomeAssistantNotConnectedError extends Error {
  constructor() {
    super("Home Assistant is not connected for this property");
    this.name = "HomeAssistantNotConnectedError";
  }
}

/**
 * Long-lived HA tokens live in integrations.credentials (jsonb), same
 * pattern as Spotify: only the service role reads/writes this column.
 * There is no app-level AES wrapper — "encrypted at rest" is Supabase
 * disk encryption plus service-role-only access.
 *
 * Home Assistant is on the LAN; Vercel cannot call it. The token is
 * handed to the browser via a member-gated route
 * (`/api/home-assistant/client-config`). That is an accepted tradeoff:
 * anyone signed in as a hive member on the house network can use HA.
 */
export async function saveHomeAssistantCredentials(
  propertyId: string,
  credentials: HomeAssistantCredentials,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("integrations").upsert(
    {
      property_id: propertyId,
      integration_type: "home_assistant",
      display_name: "Home Assistant",
      credentials,
      is_connected: true,
      last_synced_at: now,
      updated_at: now,
    },
    { onConflict: "property_id,integration_type" },
  );

  if (error) {
    throw new Error(
      `Failed to save Home Assistant credentials: ${error.message}`,
    );
  }
}

export async function clearHomeAssistantCredentials(
  propertyId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("integrations").upsert(
    {
      property_id: propertyId,
      integration_type: "home_assistant",
      display_name: "Home Assistant",
      credentials: {},
      is_connected: false,
      updated_at: now,
    },
    { onConflict: "property_id,integration_type" },
  );

  if (error) {
    throw new Error(
      `Failed to clear Home Assistant credentials: ${error.message}`,
    );
  }
}

async function loadHomeAssistantIntegration(propertyId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("credentials, is_connected")
    .eq("property_id", propertyId)
    .eq("integration_type", "home_assistant")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load Home Assistant integration: ${error.message}`,
    );
  }

  return data;
}

export async function loadHomeAssistantCredentials(
  propertyId: string,
): Promise<HomeAssistantCredentials> {
  const row = await loadHomeAssistantIntegration(propertyId);
  if (!row?.is_connected) {
    throw new HomeAssistantNotConnectedError();
  }

  const credentials = parseHomeAssistantCredentials(row.credentials);
  if (!credentials) {
    throw new HomeAssistantNotConnectedError();
  }
  return credentials;
}

export async function isHomeAssistantConnected(
  propertyId: string,
): Promise<boolean> {
  try {
    await loadHomeAssistantCredentials(propertyId);
    return true;
  } catch (error) {
    if (error instanceof HomeAssistantNotConnectedError) return false;
    throw error;
  }
}

export async function markHomeAssistantSynced(
  propertyId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("integrations")
    .update({ last_synced_at: now, updated_at: now })
    .eq("property_id", propertyId)
    .eq("integration_type", "home_assistant");
}
