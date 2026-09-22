import "server-only";

/**
 * How many people are on the Latigo List, for Settings.
 *
 * Counts only — no addresses are ever read back out of the table, not even for
 * Dave. The list itself lives in Klaviyo.
 */

import { createServiceClient } from "@/lib/supabase/server";

export type SubscriberCount = {
  total: number;
  synced: number;
  available: boolean;
};

async function count(
  db: ReturnType<typeof createServiceClient>,
  synced: boolean | null,
): Promise<number> {
  let query = db
    .from("radio_subscribers")
    .select("id", { count: "exact", head: true });
  if (synced !== null) query = query.eq("klaviyo_synced", synced);
  const { count: rows, error } = await query;
  if (error) throw new Error(error.message);
  return rows ?? 0;
}

export async function subscriberCount(): Promise<SubscriberCount> {
  try {
    const db = createServiceClient();
    const [total, synced] = await Promise.all([
      count(db, null),
      count(db, true),
    ]);
    return { total, synced, available: true };
  } catch {
    // No service key in this environment, or the table is not there yet.
    return { total: 0, synced: 0, available: false };
  }
}
