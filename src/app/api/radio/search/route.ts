import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  browseRadioGenre,
  isRadioGenreId,
  resolveNamedStation,
  searchRadioBrowser,
} from "@/lib/radio/browser";

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
  const genre = (url.searchParams.get("genre") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();
  const city = (url.searchParams.get("city") ?? "").trim();
  const suggest = url.searchParams.get("suggest") === "1";

  try {
    if (genre) {
      if (!isRadioGenreId(genre)) {
        return NextResponse.json(
          { error: "Unknown genre" },
          { status: 400, headers: NO_STORE },
        );
      }
      const results = await browseRadioGenre(genre);
      return NextResponse.json({ results }, { headers: NO_STORE });
    }

    if (q.length < 2) {
      return NextResponse.json({ results: [] }, { headers: NO_STORE });
    }

    if (suggest) {
      return NextResponse.json(
        { result: await resolveNamedStation(q, city) },
        { headers: NO_STORE },
      );
    }

    const results = await searchRadioBrowser(q);
    return NextResponse.json({ results }, { headers: NO_STORE });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: NO_STORE },
    );
  }
}
