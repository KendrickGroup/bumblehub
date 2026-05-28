import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMusicProvider } from "@/lib/music/provider";
import { getDefaultPropertyIdForUser } from "@/lib/property";

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
    return NextResponse.json({ status: "not_connected" });
  }

  try {
    const provider = getMusicProvider();
    const body = await provider.listDevices(propertyId);
    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list devices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
