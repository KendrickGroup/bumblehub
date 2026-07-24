import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCustomBackdrops } from "@/lib/guestbook/backdrops";
import { GuestbookCapture } from "./GuestbookCapture";

export const metadata: Metadata = {
  title: "Guestbook",
};

export default async function GuestbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/guestbook");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("default_property_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let propertyName = "Your hive";
  let customBackdrops = parseCustomBackdrops(null);

  if (settings?.default_property_id) {
    const propertyId = settings.default_property_id;
    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();

    if (property?.name) {
      propertyName = property.name;
    }

    const { data: propSettings } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    customBackdrops = parseCustomBackdrops(propSettings?.dashboard_layout);
  }

  return (
    <GuestbookCapture
      propertyName={propertyName}
      hasProperty={!!settings?.default_property_id}
      customBackdrops={customBackdrops}
    />
  );
}
