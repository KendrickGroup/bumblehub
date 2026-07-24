import Link from "next/link";
import { redirect } from "next/navigation";
import { BeeMark } from "@/components/brand/AppBrandLockup";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  const { next = "/home" } = await searchParams;
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="relative flex min-h-full flex-col bg-[#FAF8F3] px-6 py-12">
      <div className="absolute top-5 left-5 z-10 sm:top-6 sm:left-6">
        <Link
          href="/"
          className="text-sm font-medium text-stone-500 transition hover:text-stone-800"
        >
          ← Back
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <Link href="/" className="inline-block" aria-label="BumbleHub home">
              <BeeMark size={44} className="mx-auto" />
            </Link>
            <h1 className="mt-4 text-3xl font-semibold text-stone-900">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Your touch-first smart home dashboard
            </p>
          </div>

          {!configured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Supabase is not configured. Add{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{" "}
              to <code className="font-mono text-xs">.env.local</code>.
            </div>
          )}

          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
