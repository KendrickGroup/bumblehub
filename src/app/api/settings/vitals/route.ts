import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  DEFAULT_VITALS_CONFIG,
  parseVitalsConfig,
  type VitalsConfig,
} from "@/lib/home/vitals";

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
      config: DEFAULT_VITALS_CONFIG,
      hasProperty: false,
    });
  }

  const layout = await loadLayout(propertyId);
  return NextResponse.json({
    config: parseVitalsConfig(layout),
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

  const payload = body as Record<string, unknown>;
  const current = parseVitalsConfig(await loadLayout(propertyId));
  const next: VitalsConfig = {
    water: pickEntity(payload.water, current.water),
    battery: pickEntity(payload.battery, current.battery),
    solar: pickEntity(payload.solar, current.solar),
  };

  const layout = await loadLayout(propertyId);
  layout.vitals_config = next;

  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: next });
}

function pickEntity(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const id = value.trim();
  if (!id) return null;
  return id.startsWith("sensor.") ? id : fallback;
}
