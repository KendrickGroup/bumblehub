import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

/**
 * The 15% radio offer list, for Settings only.
 * The table has no read policy, so this uses the service key after the
 * settings session has already confirmed a signed-in owner.
 */

export type SignupRow = {
  email: string;
  created_at: string;
  source: string | null;
};

export type SignupReport = {
  available: boolean;
  total: number;
  lastDay: number;
  lastWeek: number;
  latest: string | null;
  recent: SignupRow[];
};

const RECENT_LIMIT = 50;
const PAGE = 1000;

const EMPTY: SignupReport = {
  available: false,
  total: 0,
  lastDay: 0,
  lastWeek: 0,
  latest: null,
  recent: [],
};

export async function fetchSignupReport(): Promise<SignupReport> {
  try {
    const db = createServiceClient();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [totalRes, dayRes, weekRes, recentRes] = await Promise.all([
      db.from("radio_signups").select("id", { count: "exact", head: true }),
      db
        .from("radio_signups")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo),
      db
        .from("radio_signups")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      db
        .from("radio_signups")
        .select("email, created_at, source")
        .order("created_at", { ascending: false })
        .limit(RECENT_LIMIT),
    ]);
    if (totalRes.error || dayRes.error || weekRes.error || recentRes.error) {
      return EMPTY;
    }
    const recent = (recentRes.data ?? []) as SignupRow[];
    return {
      available: true,
      total: totalRes.count ?? 0,
      lastDay: dayRes.count ?? 0,
      lastWeek: weekRes.count ?? 0,
      latest: recent[0]?.created_at ?? null,
      recent,
    };
  } catch {
    return EMPTY;
  }
}

export async function fetchAllSignups(): Promise<SignupRow[]> {
  const db = createServiceClient();
  const rows: SignupRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("radio_signups")
      .select("email, created_at, source")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SignupRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function signupsToCsv(rows: SignupRow[]): string {
  const lines = ["email,created_at,source"];
  for (const row of rows) {
    lines.push(
      [csvCell(row.email), csvCell(row.created_at), csvCell(row.source ?? "")].join(
        ",",
      ),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Pacific time, so the ranch clock matches the rest of the house. */
export function formatSignupWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(date);
}
