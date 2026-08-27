import { Bricolage_Grotesque, Fraunces, Rye, Special_Elite } from "next/font/google";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

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

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div
      className={`${fraunces.variable} ${bricolage.variable} ${rye.variable} ${elite.variable} min-h-full font-[family-name:var(--font-bricolage)]`}
    >
      <AppShell>{children}</AppShell>
    </div>
  );
}
