import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { parseVitalsConfig } from "@/lib/home/vitals";
import { VitalsGauges } from "@/components/home/VitalsGauges";

export const metadata: Metadata = {
  title: "Vitals",
};

export default async function VitalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;

  let config = parseVitalsConfig(null);
  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    config = parseVitalsConfig(data?.dashboard_layout);
  }

  return (
    <div className="px-2 py-4 sm:px-0">
      <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
        The cabin
      </p>
      <h1
        className="mt-1 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
        style={{ fontVariationSettings: '"opsz" 72' }}
      >
        Vitals
      </h1>
      <p className="mt-2 max-w-xl text-sm text-stone-600">
        Live reads from the house. Values show a dash if Home Assistant
        isn&apos;t reachable.
      </p>
      <div className="mt-6">
        <VitalsGauges config={config} />
      </div>
    </div>
  );
}
