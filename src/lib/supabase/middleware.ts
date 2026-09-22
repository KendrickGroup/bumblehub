import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  BUMBLEHUB_ORIGIN,
  isRadioHostName,
} from "@/lib/radio/host";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/signout",
  "/p",
  "/radio",
  "/manifest.webmanifest",
  "/api/radio/feed",
  "/api/radio/now-playing",
  "/api/radio/public",
  "/api/radio/stationwx",
  "/api/shop/status",
];

const EMBED_FRAME_ANCESTORS =
  "frame-ancestors 'self' https://latigocowboy.com https://www.latigocowboy.com https://*.myshopify.com";

function requestHostname(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const raw =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.hostname;
  return (raw.split(":")[0] ?? "").toLowerCase();
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function isEmbeddablePath(pathname: string, radioHost: boolean): boolean {
  if (radioHost && (pathname === "/" || pathname === "")) return true;
  if (pathname === "/radio" || pathname.startsWith("/radio/")) return true;
  if (pathname.startsWith("/api/radio/feed")) return true;
  if (pathname.startsWith("/api/radio/now-playing")) return true;
  if (pathname.startsWith("/api/radio/public")) return true;
  if (pathname.startsWith("/api/radio/stationwx")) return true;
  return false;
}

function isRadioHostAllowed(pathname: string): boolean {
  if (pathname === "/radio" || pathname.startsWith("/radio/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/flags/")) return true;
  if (
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/icon.png" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest"
  ) {
    return true;
  }
  if (pathname.startsWith("/api/radio/public")) return true;
  if (pathname.startsWith("/api/radio/stationwx")) return true;
  if (pathname.startsWith("/api/radio/feed")) return true;
  if (pathname.startsWith("/api/radio/now-playing")) return true;
  if (
    pathname === "/api/radio/subscribe" ||
    pathname.startsWith("/api/radio/subscribe/")
  ) {
    return true;
  }
  return false;
}

function applyFrameHeaders(request: NextRequest, response: NextResponse) {
  const pathname = request.nextUrl.pathname;
  const radioHost = isRadioHostName(requestHostname(request));
  if (isEmbeddablePath(pathname, radioHost)) {
    response.headers.set("Content-Security-Policy", EMBED_FRAME_ANCESTORS);
    response.headers.delete("X-Frame-Options");
    return;
  }
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  response.headers.set("X-Frame-Options", "DENY");
}

function withRadioHostHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  applyFrameHeaders(request, response);
  return response;
}

function handleRadioHost(request: NextRequest): NextResponse | null {
  if (!isRadioHostName(requestHostname(request))) return null;

  const pathname = request.nextUrl.pathname;

  if (pathname === "/" || pathname === "") {
    const url = request.nextUrl.clone();
    url.pathname = "/radio";
    return withRadioHostHeaders(request, NextResponse.rewrite(url));
  }

  if (pathname === "/sw.js") {
    const url = request.nextUrl.clone();
    url.pathname = "/radio/sw.js";
    return withRadioHostHeaders(request, NextResponse.rewrite(url));
  }

  if (isRadioHostAllowed(pathname)) {
    return withRadioHostHeaders(request, NextResponse.next({ request }));
  }

  const dest = new URL(
    `${pathname}${request.nextUrl.search}`,
    BUMBLEHUB_ORIGIN,
  );
  return NextResponse.redirect(dest, 308);
}

export async function updateSession(request: NextRequest) {
  const radio = handleRadioHost(request);
  if (radio) return radio;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    applyFrameHeaders(request, response);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicPath(pathname);

  if (user && pathname === "/login") {
    const redirect = NextResponse.redirect(new URL("/home", request.url));
    applyFrameHeaders(request, redirect);
    return redirect;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(url);
    applyFrameHeaders(request, redirect);
    return redirect;
  }

  applyFrameHeaders(request, response);
  return response;
}
