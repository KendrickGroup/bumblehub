import type { NextConfig } from "next";

const RADIO_HOST = (
  process.env.NEXT_PUBLIC_RADIO_HOST ?? "radio.latigocowboy.com"
)
  .trim()
  .toLowerCase();

const RADIO_FRAME_ANCESTORS =
  "frame-ancestors 'self' https://latigocowboy.com https://www.latigocowboy.com https://*.myshopify.com";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fvsxemuaxbpakaiyvujq.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: RADIO_HOST }],
        headers: [
          { key: "Content-Security-Policy", value: RADIO_FRAME_ANCESTORS },
        ],
      },
      {
        source: "/radio",
        headers: [
          { key: "Content-Security-Policy", value: RADIO_FRAME_ANCESTORS },
        ],
      },
      {
        source: "/radio/:path*",
        headers: [
          { key: "Content-Security-Policy", value: RADIO_FRAME_ANCESTORS },
        ],
      },
    ];
  },
};

export default nextConfig;
