import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { PhotoBooth } from "./PhotoBooth";

export const metadata: Metadata = {
  title: "Latigo Cowboy Portrait Co.",
};

export default async function HivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  return <PhotoBooth hasProperty={!!propertyId} />;
}
