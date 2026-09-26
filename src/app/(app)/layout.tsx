import { Bricolage_Grotesque, Fraunces, Rye, Special_Elite } from "next/font/google";
import { Suspense } from "react";
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

function ShellSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 pt-2" aria-hidden>
      <div className="h-16 w-52 rounded-2xl bg-[#EFE6D6]" />
      <div className="mt-3 h-6 w-24 rounded-full bg-[#EFE6D6]" />
      <div className="h-24 rounded-[20px] bg-[#EFE6D6]" />
    </div>
  );
}

async function SessionGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return children;
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${fraunces.variable} ${bricolage.variable} ${rye.variable} ${elite.variable} min-h-full font-[family-name:var(--font-bricolage)]`}
    >
      <Suspense fallback={null}>
        <AppShell>
          <Suspense fallback={<ShellSkeleton />}>
            <SessionGate>{children}</SessionGate>
          </Suspense>
        </AppShell>
      </Suspense>
    </div>
  );
}
