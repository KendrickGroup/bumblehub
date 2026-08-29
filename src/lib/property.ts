import { createClient, createServiceClient } from "@/lib/supabase/server";

const MEMBER_ROLES = new Set(["owner", "admin", "member"]);

export async function getDefaultPropertyIdForUser(
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("default_property_id")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.default_property_id ?? null;
}

/** Owner / admin / member — guests cannot receive the HA token. */
export async function userIsPropertyMember(
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from("property_members")
    .select("role")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.role) {
    return MEMBER_ROLES.has(data.role);
  }

  // Legacy: default hive set but no membership row yet.
  const defaultId = await getDefaultPropertyIdForUser(userId);
  return defaultId === propertyId;
}
