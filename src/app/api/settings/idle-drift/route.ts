import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  DEFAULT_IDLE_DRIFT_SETTINGS,
  IDLE_DRIFT_MINUTES,
  parseIdleDriftSettings,
  type IdleDriftMinutes,
  type IdleDriftSettings,
} from "@/lib/idle/settings";

async function loadLayout(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_settings")
    .select("dashboard_layout")
    .eq("property_id", propertyId)
    .maybeSingle();

  return data?.dashboard_layout && typeof data.dashboard_layout === "object"
    ? { ...(data.dashboard_layout as Record<string, unknown>) }
    : {};
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json({
      settings: DEFAULT_IDLE_DRIFT_SETTINGS,
      hasProperty: false,
    });
  }

  const layout = await loadLayout(propertyId);
  return NextResponse.json({
    settings: parseIdleDriftSettings(layout),
    hasProperty: true,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json(
      { error: "No default property configured" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as {
    enabled?: unknown;
    minutes?: unknown;
  };

  const current = parseIdleDriftSettings(await loadLayout(propertyId));
  const next: IdleDriftSettings = { ...current };

  if (typeof payload.enabled === "boolean") {
    next.enabled = payload.enabled;
  }
  if (
    typeof payload.minutes === "number" &&
    (IDLE_DRIFT_MINUTES as readonly number[]).includes(payload.minutes)
  ) {
    next.minutes = payload.minutes as IdleDriftMinutes;
  }

  const layout = await loadLayout(propertyId);
  layout.idle_drift_enabled = next.enabled;
  layout.idle_drift_minutes = next.minutes;

  const now = new Date().toISOString();
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: now,
    },
    { onConflict: "property_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: next });
}
