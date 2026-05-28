import { headers } from "next/headers";

/** Canonical production origin when env and request origin are unavailable. */
export const DEFAULT_SITE_URL = "https://bumblehub.dev";

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  return url.replace(/\/$/, "");
}

/** Prefer the incoming request origin (works for local dev and deployed hosts). */
export function getOriginFromRequest(request: Request): string {
  try {
    const { origin } = new URL(request.url);
    if (origin && origin !== "null") {
      return origin.replace(/\/$/, "");
    }
  } catch {
    // fall through
  }
  return getSiteUrl();
}

/** For server actions that don't receive a Request. */
export async function getOriginFromHeaders(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (host) {
    const proto =
      headerStore.get("x-forwarded-proto") ??
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return getSiteUrl();
}
