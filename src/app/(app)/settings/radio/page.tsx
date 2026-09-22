import type { Metadata } from "next";
import { settingsSession } from "@/lib/settings/session";
import { parseChartArt } from "@/lib/radio/chart-art";
import { ensureLaunchStations } from "@/lib/radio/queries";
import { ensureWxStreamUrl } from "@/lib/radio/wx-stream";
import { RadioSettingsPanel } from "../RadioSettingsPanel";
import { StationPlaysPanel } from "@/components/settings/AnalyticsPanels";

export const metadata: Metadata = {
  title: "Radio · Settings",
};

export default async function RadioSettingsPage() {
  const { supabase, propertyId } = await settingsSession();
  let radioStations: Awaited<ReturnType<typeof ensureLaunchStations>> = [];
  let wxStreamUrl = "";
  let chartArt = parseChartArt(null);

  if (propertyId) {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    chartArt = parseChartArt(data?.dashboard_layout);
    radioStations = await ensureLaunchStations(propertyId);
    wxStreamUrl = await ensureWxStreamUrl(supabase, propertyId);
  }

  return (
    <>
      <RadioSettingsPanel
        hasProperty={!!propertyId}
        initialStations={radioStations}
        initialWxStreamUrl={wxStreamUrl}
        initialChartArt={chartArt}
      />
      <StationPlaysPanel />
    </>
  );
}
