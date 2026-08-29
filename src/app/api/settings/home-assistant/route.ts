import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultPropertyIdForUser,
  userIsPropertyMember,
} from "@/lib/property";
import {
  normalizeHomeAssistantUrl,
  parseHomeAssistantUrl,
} from "@/lib/integrations/home-assistant";
import {
  clearHomeAssistantCredentials,
  isHomeAssistantConnected,
  saveHomeAssistantCredentials,
} from "@/lib/home-assistant/tokens";

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
      url: "",
      hasProperty: false,
      hasToken: false,
    });
  }

  const layout = await loadLayout(propertyId);
  let hasToken = false;
  try {
    hasToken = await isHomeAssistantConnected(propertyId);
  } catch {
    hasToken = false;
  }

  return NextResponse.json({
    url: parseHomeAssistantUrl(layout),
    hasProperty: true,
    hasToken,
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

  if (!(await userIsPropertyMember(propertyId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as {
    url?: unknown;
    token?: unknown;
    action?: unknown;
  };

  if (payload.action === "disconnect") {
    try {
      await clearHomeAssistantCredentials(propertyId);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to disconnect",
        },
        { status: 500 },
      );
    }
    const layout = await loadLayout(propertyId);
    return NextResponse.json({
      url: parseHomeAssistantUrl(layout),
      hasToken: false,
    });
  }

  let urlResult: string | undefined;
  if (typeof payload.url === "string") {
    try {
      urlResult = normalizeHomeAssistantUrl(payload.url);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid URL" },
        { status: 400 },
      );
    }

    const layout = await loadLayout(propertyId);
    if (urlResult) {
      layout.home_assistant_url = urlResult;
    } else {
      delete layout.home_assistant_url;
    }

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
  }

  let hasToken = false;
  try {
    hasToken = await isHomeAssistantConnected(propertyId);
  } catch {
    hasToken = false;
  }

  if (typeof payload.token === "string") {
    const token = payload.token.trim();
    if (!token) {
      return NextResponse.json(
        { error: "Paste a long-lived access token" },
        { status: 400 },
      );
    }
    try {
      await saveHomeAssistantCredentials(propertyId, { access_token: token });
      hasToken = true;
    } catch (err) {
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Failed to save token",
        },
        { status: 500 },
      );
    }
  }

  const layout = await loadLayout(propertyId);
  return NextResponse.json({
    url: urlResult ?? parseHomeAssistantUrl(layout),
    hasToken,
  });
}
