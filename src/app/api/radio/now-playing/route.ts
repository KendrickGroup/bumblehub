import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchIcyNowPlaying } from "@/lib/radio/icy";
import { isHttpsStreamUrl } from "@/lib/radio/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const url = new URL(request.url);
  const streamUrl = (url.searchParams.get("url") ?? "").trim();
  if (!isHttpsStreamUrl(streamUrl)) {
    return NextResponse.json({ track: null }, { headers: NO_STORE });
  }

  try {
    const track = await fetchIcyNowPlaying(streamUrl);
    return NextResponse.json({ track }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ track: null }, { headers: NO_STORE });
  }
}
