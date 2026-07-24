"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOriginFromHeaders } from "@/lib/site";

export type LoginResult = { ok: false; error: string };
export type MagicLinkResult = { ok: true; message: string } | LoginResult;

function missingConfig(): LoginResult {
  return {
    ok: false,
    error:
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  };
}

export async function signInWithPassword(
  _prevState: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/home");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return missingConfig();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect(next);
}

export async function sendMagicLink(
  _prevState: MagicLinkResult | null,
  formData: FormData,
): Promise<MagicLinkResult> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "/home");

  if (!email) {
    return { ok: false, error: "Email is required." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return missingConfig();
  }

  const supabase = await createClient();
  const origin = await getOriginFromHeaders();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    message: "Check your email for a sign-in link.",
  };
}
