import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Rye, Special_Elite } from "next/font/google";
import { RadioPwa } from "@/components/radio/RadioPwa";
import {
  isRadioHostName,
  RADIO_OG_DESCRIPTION,
  RADIO_ORIGIN,
} from "@/lib/radio/host";

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

const RADIO_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/radio/icon-192.png", sizes: "192x192", type: "image/png" },
    { url: "/radio/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [
    { url: "/radio/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ],
};

type AppleWebAppConfig = Exclude<
  NonNullable<Metadata["appleWebApp"]>,
  boolean
>;

const STARTUP_IMAGES: NonNullable<AppleWebAppConfig["startupImage"]> = [
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
];

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const branded = isRadioHostName(host);

  const base: Metadata = {
    title: {
      absolute: "Latigo Radio",
    },
    description: RADIO_OG_DESCRIPTION,
    applicationName: "Latigo Radio",
    manifest: branded ? "/manifest.webmanifest" : "/radio/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Latigo Radio",
      statusBarStyle: "black-translucent",
      startupImage: STARTUP_IMAGES,
    },
    icons: RADIO_ICONS,
    other: {
      "mobile-web-app-capable": "yes",
    },
  };

  if (!branded) return base;

  return {
    ...base,
    metadataBase: new URL(RADIO_ORIGIN),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: "/",
      siteName: "Latigo Radio",
      title: "Latigo Radio",
      description: RADIO_OG_DESCRIPTION,
      images: [
        {
          url: "/radio/og.png",
          width: 1200,
          height: 630,
          alt: "Latigo Radio",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Latigo Radio",
      description: RADIO_OG_DESCRIPTION,
      images: ["/radio/og.png"],
    },
  };
}

export default function RadioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${bricolage.variable} ${rye.variable} ${elite.variable} h-dvh overflow-hidden bg-[#FAF8F3] font-[family-name:var(--font-bricolage)]`}
    >
      <RadioPwa />
      {children}
    </div>
  );
}
