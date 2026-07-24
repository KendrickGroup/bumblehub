import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DEFAULT_SITE_URL, getSiteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
