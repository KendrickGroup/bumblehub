import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BUILD_SHA, BUILD_TIME_ISO } from "@/lib/build-info";
import { DEFAULT_SITE_URL, getSiteUrl } from "@/lib/site";
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
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/icon.png",
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
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
