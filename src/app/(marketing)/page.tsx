import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "BumbleHub: Your whole home, one warm little screen",
  description:
    "BumbleHub is the calm, touch-first home dashboard. Control your lights, set the vibe, follow recipes with a smart cooking helper, and keep the house humming. No phones, no app-juggling.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return <LandingPage />;
}
