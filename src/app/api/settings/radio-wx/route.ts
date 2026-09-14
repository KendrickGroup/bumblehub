import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isHttpsStreamUrl } from "@/lib/radio/types";
import { ensureWxStreamUrl, saveWxStreamUrl } from "@/lib/radio/wx-stream";

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
    return NextResponse.json({ wx_stream_url: "", hasProperty: false });
  }

  const wx_stream_url = await ensureWxStreamUrl(supabase, propertyId);
  return NextResponse.json({ wx_stream_url, hasProperty: true });
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

  const raw = (body as { wx_stream_url?: unknown }).wx_stream_url;
  if (typeof raw !== "string") {
    return NextResponse.json(
      { error: "wx_stream_url must be a string." },
      { status: 400 },
    );
  }
  const trimmed = raw.trim();
  if (trimmed && !isHttpsStreamUrl(trimmed)) {
    return NextResponse.json(
      { error: "Weather stream URL must start with https://." },
      { status: 400 },
    );
  }

  try {
    const wx_stream_url = await saveWxStreamUrl(supabase, propertyId, trimmed);
    return NextResponse.json({ wx_stream_url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save." },
      { status: 500 },
    );
  }
}
