"use client";

/**
 * The 15% family offer. The stream is left alone: this sits over the cabinet
 * and never stops playback.
 */

import { useEffect, useState } from "react";
import { cleanEmail } from "@/lib/radio/latigo-list";
import { offerRewardFrom, type OfferReward } from "@/lib/radio/offer-gate";

export function RadioOfferModal({
  source,
  saved,
  onJoined,
  onClose,
}: {
  source: string | null;
  /** Already signed up on this browser. The card shows the code, not the form. */
  saved: OfferReward | null;
  onJoined: (reward: OfferReward) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<OfferReward | null>(null);
  const showing = saved ?? reward;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || showing) return;
    const clean = cleanEmail(email);
    if (!clean) {
      setError("That email doesn't look right. Mind checking it?");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/radio/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, source }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        code?: unknown;
        shopUrl?: unknown;
      } | null;
      const next = response.ok && body?.ok ? offerRewardFrom(body) : null;
      if (!next) {
        setError(body?.error ?? "The wire's down. Try that again in a minute.");
        setBusy(false);
        return;
      }
      onJoined(next);
      setReward(next);
      setBusy(false);
    } catch {
      setError("The wire's down. Try that again in a minute.");
      setBusy(false);
    }
  };

  return (
    <div
      className="radio-handle-modal radio-list-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="radio-offer-title"
    >
      <button
        type="button"
        className="radio-handle-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="radio-handle-card radio-list-card">
        <span className="radio-screwdot tl" aria-hidden />
        <span className="radio-screwdot tr" aria-hidden />
        <span className="radio-screwdot bl" aria-hidden />
        <span className="radio-screwdot br" aria-hidden />
        <button
          type="button"
          className="radio-offer-x"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>

        {showing ? (
          <div className="radio-list-done" role="status">
            <h2 id="radio-offer-title" className="radio-list-title">
              Here&apos;s your code
            </h2>
            <p className="radio-offer-code">{showing.code}</p>
            <p className="radio-list-sub">
              Here&apos;s your code: {showing.code}. 15% off your first order.
            </p>
            <a
              className="radio-handle-install radio-list-go"
              href={showing.shopUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          <>
            <h2 id="radio-offer-title" className="radio-list-title">
              Welcome to the Family
            </h2>
            <p className="radio-list-sub">
              Drop your email and we&apos;ll send 15% off your first order.
              Knock out your Christmas shopping early, Black Friday&apos;s
              coming up fast.
            </p>
            <form className="radio-list-form" onSubmit={submit} noValidate>
              <input
                type="email"
                name="email"
                className="radio-list-input"
                placeholder="you@example.com"
                aria-label="Email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                maxLength={254}
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  if (error) setError(null);
                }}
              />
              {error ? (
                <p className="radio-list-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="radio-handle-install radio-list-go"
                disabled={busy}
              >
                {busy ? "Joining…" : "Join the Family"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
