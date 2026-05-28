"use client";

import { useActionState, useState } from "react";
import {
  sendMagicLink,
  signInWithPassword,
  type LoginResult,
  type MagicLinkResult,
} from "./actions";

type Mode = "password" | "magic";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [passwordState, passwordAction, passwordPending] = useActionState<
    LoginResult | null,
    FormData
  >(signInWithPassword, null);
  const [magicState, magicAction, magicPending] = useActionState<
    MagicLinkResult | null,
    FormData
  >(sendMagicLink, null);

  const pending = mode === "password" ? passwordPending : magicPending;

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-stone-100 p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`min-h-[44px] flex-1 rounded-xl text-sm font-medium transition ${
            mode === "password"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`min-h-[44px] flex-1 rounded-xl text-sm font-medium transition ${
            mode === "magic"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600"
          }`}
        >
          Magic link
        </button>
      </div>

      {mode === "password" ? (
        <form action={passwordAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <EmailField />
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            />
          </div>
          {passwordState?.ok === false && (
            <p className="text-sm text-red-600">{passwordState.error}</p>
          )}
          <SubmitButton pending={pending} label="Sign in" />
        </form>
      ) : (
        <form action={magicAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <EmailField />
          {magicState?.ok === false && (
            <p className="text-sm text-red-600">{magicState.error}</p>
          )}
          {magicState?.ok === true && (
            <p className="text-sm text-emerald-700">{magicState.message}</p>
          )}
          <SubmitButton pending={pending} label="Email me a link" />
        </form>
      )}
    </div>
  );
}

function EmailField() {
  return (
    <div>
      <label htmlFor="email" className="block text-sm font-medium text-stone-700">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
      />
    </div>
  );
}

function SubmitButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] w-full rounded-xl bg-stone-900 px-4 text-base font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}
