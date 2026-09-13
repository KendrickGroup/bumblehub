import { createServiceClient } from "@/lib/supabase/server";

export async function getPublicRadioPropertyId(): Promise<string | null> {
  const fromEnv = process.env.PUBLIC_RADIO_PROPERTY_ID?.trim();
  if (fromEnv) return fromEnv;

  const service = createServiceClient();
  const { data } = await service
    .from("radio_stations")
    .select("property_id")
    .limit(1)
    .maybeSingle();
  return data?.property_id ?? null;
}
