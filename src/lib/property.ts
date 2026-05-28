import { createClient } from "@/lib/supabase/server";

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
