/**
 * Shopify fetch failures, kept on the property so Settings > System can show
 * them. Ten entries is enough to see a pattern without growing the layout row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SHOPIFY_LOG_MAX = 10;

export type ShopifyLogEntry = {
  at: string;
  code: string;
  message: string;
};

export function parseShopifyLog(dashboardLayout: unknown): ShopifyLogEntry[] {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return [];
  const raw = (dashboardLayout as Record<string, unknown>).shopify_fetch_log;
  if (!Array.isArray(raw)) return [];
  const out: ShopifyLogEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const at = String(row.at ?? "").trim();
    if (!at) continue;
    out.push({
      at,
      code: String(row.code ?? "error").slice(0, 60),
      message: String(row.message ?? "").slice(0, 200),
    });
    if (out.length >= SHOPIFY_LOG_MAX) break;
  }
  return out;
}

/** Never throws: logging a Shopify outage must not fail the request too. */
export async function recordShopifyFailure(
  supabase: SupabaseClient,
  propertyId: string,
  failure: { code: string; message: string },
): Promise<void> {
  try {
    const { data } = await supabase
      .from("property_settings")
      .select("dashboard_layout")
      .eq("property_id", propertyId)
      .maybeSingle();
    const layout =
      data?.dashboard_layout && typeof data.dashboard_layout === "object"
        ? { ...(data.dashboard_layout as Record<string, unknown>) }
        : {};
    const entry: ShopifyLogEntry = {
      at: new Date().toISOString(),
      code: failure.code.slice(0, 60),
      message: failure.message.slice(0, 200),
    };
    const existing = parseShopifyLog(layout);
    // Don't fill the log with the same failure once a minute.
    const duplicate =
      existing[0] &&
      existing[0].code === entry.code &&
      Date.now() - Date.parse(existing[0].at) < 5 * 60 * 1000;
    if (duplicate) return;
    layout.shopify_fetch_log = [entry, ...existing].slice(0, SHOPIFY_LOG_MAX);
    await supabase.from("property_settings").upsert(
      {
        property_id: propertyId,
        dashboard_layout: layout,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id" },
    );
  } catch {
    // Logging is best effort.
  }
}
