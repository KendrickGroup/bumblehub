/**
 * Both Settings lists, behind the session. The toggles re-fetch rather than
 * reload the page, so the range and include-my-own choices stay put while Dave
 * flips between them.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchBanner, bannerEventHandle } from "@/lib/radio/banner";
import {
  ANALYTICS_RANGE_DEFAULT,
  isAnalyticsRange,
} from "@/lib/radio/analytics";
import { productTotals, stationTotals } from "@/lib/radio/analytics-queries";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rangeRaw = url.searchParams.get("range");
  const range = isAnalyticsRange(rangeRaw) ? rangeRaw : ANALYTICS_RANGE_DEFAULT;
  const includeOwner = url.searchParams.get("owner") === "1";

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  const live = new Set<string>();
  if (propertyId) {
    const banner = await fetchBanner(supabase, propertyId);
    for (const product of [...banner.picks, ...banner.uploads]) {
      const handle = bannerEventHandle(product);
      if (handle) live.add(handle);
    }
  }

  try {
    const [stations, products] = await Promise.all([
      stationTotals(range, includeOwner),
      productTotals(range, includeOwner, live),
    ]);
    return NextResponse.json(
      { range, includeOwner, stations, products },
      { headers: NO_STORE },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not read the numbers.",
      },
      { status: 500 },
    );
  }
}
