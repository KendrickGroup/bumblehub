import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";

export async function settingsSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;
  return { supabase, user, propertyId };
}

export function tryServiceClient() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}
