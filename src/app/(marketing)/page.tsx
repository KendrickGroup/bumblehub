import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "BumbleHub — Your whole home, one warm little screen",
  description:
    "BumbleHub is the calm, touch-first home dashboard. Control your lights, set the vibe, follow recipes with a smart cooking helper, and keep the house humming — no phones, no app-juggling.",
  openGraph: {
    title: "BumbleHub — Your whole home, one warm little screen",
    description:
      "The calm, touch-first home dashboard for lights, music, recipes, and more.",
    url: DEFAULT_SITE_URL,
    siteName: "BumbleHub",
  },
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
