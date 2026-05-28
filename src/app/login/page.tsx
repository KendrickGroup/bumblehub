import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/dashboard" } = await searchParams;
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#FAF8F3] px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
            BumbleHub
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900">Sign in</h1>
          <p className="mt-1 text-sm text-stone-500">
            Your touch-first smart home dashboard
          </p>
        </div>

        {!configured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Supabase is not configured. Add{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            to <code className="font-mono text-xs">.env.local</code>.
          </div>
        )}

        <LoginForm next={next} />
      </div>
    </div>
  );
}
