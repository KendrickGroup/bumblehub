import { NextResponse } from "next/server";
import { parseHomeAssistantUrl } from "@/lib/integrations/home-assistant";
import { requireHiveMember } from "@/lib/home-assistant/require-member";
import { loadHomeAssistantCredentials } from "@/lib/home-assistant/tokens";
import { createClient } from "@/lib/supabase/server";

/**
 * Hands the Home Assistant long-lived access token to the browser.
 *
 * Home Assistant lives on the LAN (homeassistant.local / 192.168.0.29).
 * Vercel cannot reach it, so every HA REST call must run client-side
 * (`fetch(<ha_url>/api/*, Bearer token)`). That means the token has to
 * travel to the wall tablet / phone on the same network.
 *
 * Gated to property members (not guests). Treat the token as a house
 * secret: anyone who can open this app as a member can call HA.
 */
export async function GET() {
  const auth = await requireHiveMember();
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", auth.propertyId)
    .maybeSingle();

  const url = parseHomeAssistantUrl(data?.dashboard_layout);

  try {
    const credentials = await loadHomeAssistantCredentials(auth.propertyId);
    return NextResponse.json({
      url,
      token: credentials.access_token,
      connected: Boolean(url && credentials.access_token),
    });
  } catch {
    return NextResponse.json({
      url,
      token: null,
      connected: false,
    });
  }
}
