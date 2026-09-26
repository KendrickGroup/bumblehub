import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { PhotoBoothLoader } from "./PhotoBoothLoader";

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

  return <PhotoBoothLoader hasProperty={!!propertyId} />;
}
