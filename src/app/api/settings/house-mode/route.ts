import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import {
  hashHouseModePin,
  isValidPin,
  verifyHouseModePin,
} from "@/lib/house-mode/pin";
import {
  DEFAULT_HOUSE_GREETING,
  parseHouseModeSettings,
} from "@/lib/house-mode/settings";

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

async function saveLayout(
  propertyId: string,
  layout: Record<string, unknown>,
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("property_settings").upsert(
    {
      property_id: propertyId,
      dashboard_layout: layout,
      updated_at: now,
    },
    { onConflict: "property_id" },
  );
  return error;
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
      hasProperty: false,
      hasPin: false,
      greeting: DEFAULT_HOUSE_GREETING,
      propertyName: null,
      isOwner: false,
    });
  }

  const layout = await loadLayout(propertyId);
  const parsed = parseHouseModeSettings(layout);
  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .maybeSingle();

  return NextResponse.json({
    hasProperty: true,
    hasPin: Boolean(parsed.pinHash),
    greeting: parsed.greeting,
    propertyName: property?.name ?? null,
    isOwner: await isPropertyOwner(propertyId, user.id),
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

  const action = (body as { action?: unknown }).action;
  const layout = await loadLayout(propertyId);
  const parsed = parseHouseModeSettings(layout);

  if (action === "enable") {
    const pin = (body as { pin?: unknown }).pin;
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits" },
        { status: 400 },
      );
    }

    if (parsed.pinHash) {
      if (!verifyHouseModePin(pin, parsed.pinHash)) {
        return NextResponse.json({ error: "Incorrect PIN" }, { status: 403 });
      }
    } else {
      layout.house_mode_pin_hash = hashHouseModePin(pin);
      const error = await saveLayout(propertyId, layout);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, hasPin: true });
  }

  if (action === "disable" || action === "verify") {
    const pin = (body as { pin?: unknown }).pin;
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits" },
        { status: 400 },
      );
    }
    if (!parsed.pinHash) {
      // PIN was cleared by owner — allow through so device can drop house mode.
      return NextResponse.json({ ok: true, hasPin: false });
    }
    if (!verifyHouseModePin(pin, parsed.pinHash)) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, hasPin: true });
  }

  if (action === "update_greeting") {
    const greeting = (body as { greeting?: unknown }).greeting;
    if (typeof greeting !== "string") {
      return NextResponse.json(
        { error: "greeting must be a string" },
        { status: 400 },
      );
    }
    layout.house_mode_greeting = greeting.slice(0, 120);
    const error = await saveLayout(propertyId, layout);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, greeting: layout.house_mode_greeting });
  }

  if (action === "owner_clear") {
    const isOwner = await isPropertyOwner(propertyId, user.id);
    if (!isOwner) {
      return NextResponse.json({ error: "Owner only" }, { status: 403 });
    }
    delete layout.house_mode_pin_hash;
    const error = await saveLayout(propertyId, layout);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, hasPin: false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
