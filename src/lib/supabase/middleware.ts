import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/signout",
  "/p",
  "/radio",
  "/api/radio/feed",
  "/api/radio/now-playing",
  "/api/radio/public",
  "/api/radio/stationwx",
];

const EMBED_FRAME_ANCESTORS =
  "frame-ancestors 'self' https://latigocowboy.com https://www.latigocowboy.com https://*.myshopify.com";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function isEmbeddablePath(pathname: string): boolean {
  if (pathname === "/radio" || pathname.startsWith("/radio/")) return true;
  if (pathname.startsWith("/api/radio/feed")) return true;
  if (pathname.startsWith("/api/radio/now-playing")) return true;
  if (pathname.startsWith("/api/radio/public")) return true;
  if (pathname.startsWith("/api/radio/stationwx")) return true;
  return false;
}

function applyFrameHeaders(request: NextRequest, response: NextResponse) {
  const pathname = request.nextUrl.pathname;
  if (isEmbeddablePath(pathname)) {
    response.headers.set("Content-Security-Policy", EMBED_FRAME_ANCESTORS);
    response.headers.delete("X-Frame-Options");
    return;
  }
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  response.headers.set("X-Frame-Options", "DENY");
}

export async function updateSession(request: NextRequest) {
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
