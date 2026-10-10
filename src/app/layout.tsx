import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BUILD_SHA, BUILD_TIME_ISO } from "@/lib/build-info";
import { RADIO_OG_DESCRIPTION, RADIO_OG_IMAGE, RADIO_ORIGIN } from "@/lib/radio/host";
import { DEFAULT_SITE_URL, getSiteUrl } from "@/lib/site";
import { PerfReadout } from "@/components/shell/PerfReadout";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const RADIO_SHARE = {
  title: "Latigo Radio",
  description: RADIO_OG_DESCRIPTION,
  image: {
    url: RADIO_OG_IMAGE,
    width: 1200,
    height: 630,
    alt: "Latigo Radio",
  },
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl() || DEFAULT_SITE_URL),
  title: {
    default: "BumbleHub",
    template: "%s · BumbleHub",
  },
  description: "Touch-first smart home dashboard",
  applicationName: "BumbleHub",
  appleWebApp: {
    capable: true,
    title: "BumbleHub",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    url: RADIO_ORIGIN,
    siteName: "Latigo Radio",
    title: RADIO_SHARE.title,
    description: RADIO_SHARE.description,
    images: [RADIO_SHARE.image],
  },
  twitter: {
    card: "summary_large_image",
    title: RADIO_SHARE.title,
    description: RADIO_SHARE.description,
    images: [RADIO_SHARE.image.url],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // The only place the build shows: in the head, never on the cabinet.
  other: {
    "build-sha": BUILD_SHA,
    "build-time": BUILD_TIME_ISO || "dev",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        {children}
        <PerfReadout />
      </body>
    </html>
  );
}
