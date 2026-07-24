import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import type { InfoSection } from "@/lib/info/types";
import { ensureStarterSections } from "./actions";
import { HomeInfoView } from "./HomeInfoView";

export const metadata: Metadata = {
  title: "Home Info",
};

export default async function InfoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  let propertyName: string | null = null;
  let sections: InfoSection[] = [];

  if (propertyId) {
    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();
    propertyName = property?.name ?? null;
    sections = await ensureStarterSections(propertyId);
  }

  return (
    <HomeInfoView propertyName={propertyName} initialSections={sections} />
  );
}
