import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { parseCustomBackdrops } from "@/lib/guestbook/backdrops";
import { PhotoBooth } from "./PhotoBooth";

export const metadata: Metadata = {
  title: "Photo Booth",
};

export default async function HivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  let backdrops = parseCustomBackdrops(null);
  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    backdrops = parseCustomBackdrops(data?.dashboard_layout);
  }

  return (
    <PhotoBooth hasProperty={!!propertyId} backdrops={backdrops} />
  );
}
