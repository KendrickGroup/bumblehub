import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  if (settings?.default_property_id) {
    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", settings.default_property_id)
      .maybeSingle();

    if (property?.name) {
      propertyName = property.name;
    }
  }

  return (
    <GuestbookCapture
      propertyName={propertyName}
      hasProperty={!!settings?.default_property_id}
    />
  );
}
