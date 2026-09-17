import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isRadioHostName } from "@/lib/radio/host";
import { latigoRadioManifest } from "@/lib/radio/manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const branded = isRadioHostName(host);
  return NextResponse.json(latigoRadioManifest(branded), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
