import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Rye, Special_Elite } from "next/font/google";
import { RadioPwa } from "@/components/radio/RadioPwa";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const rye = Rye({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rye",
});

const elite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-elite",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6B4F36",
};

export const metadata: Metadata = {
  title: "Ranch House Radio",
  description:
    "The ranch radio, to go. Live country from Latigo Ranch House in Sutter Creek.",
  applicationName: "Ranch House Radio",
  manifest: "/radio/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ranch House Radio",
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/radio/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/radio/splash-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/radio/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/radio/splash-1125x2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/radio/splash-1242x2688.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/radio/splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/radio/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/radio/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/radio/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RadioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${bricolage.variable} ${rye.variable} ${elite.variable} min-h-full bg-[#FAF8F3] font-[family-name:var(--font-bricolage)]`}
    >
      <RadioPwa />
      {children}
    </div>
  );
}
