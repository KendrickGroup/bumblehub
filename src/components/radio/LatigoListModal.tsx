"use client";

/**
 * The Latigo List ask, on the To-Go modal's shell.
 *
 * Nothing in here touches the audio: the stream keeps playing under it, which
 * is the point — they are being asked mid-song. Backdrop and Escape both count
 * as "not right now", so a dismissal always pushes the next ask out.
 */

import { useEffect, useState } from "react";
import { cleanEmail, LATIGO_LIST_ENDPOINT } from "@/lib/radio/latigo-list";

const CLOSE_AFTER_MS = 2500;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as { standalone?: boolean }).standalone)
  );
}

export function LatigoListModal({
  stationCall,
  onDismiss,
  onJoined,
  onClose,
}: {
  stationCall: string | null;
  /** Not right now: the gate pushes the next ask out another half hour. */
  onDismiss: () => void;
  /** Called the moment the server says yes, so nothing depends on the timer. */
  onJoined: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  // Escape is a dismissal like any other, so it pushes the next ask out too.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (joined) onClose();
      else onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joined, onClose, onDismiss]);

  useEffect(() => {
    if (!joined) return;
    const id = window.setTimeout(onClose, CLOSE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [joined, onClose]);

  const close = () => {
    if (joined) onClose();
    else onDismiss();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const clean = cleanEmail(email);
    if (!clean) {
      setError("That email doesn't look right. Mind checking it?");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(LATIGO_LIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clean,
          station_call: stationCall,
          is_pwa: isStandalone(),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        setError(body?.error ?? "The wire's down. Try that again in a minute.");
        setBusy(false);
        return;
      }
      setJoined(true);
      onJoined();
    } catch {
      setError("The wire's down. Try that again in a minute.");
      setBusy(false);
    }
  };

  const titleId = "latigo-list-title";

  return (
    <div
      className="radio-handle-modal radio-list-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="radio-handle-scrim"
        aria-label="Close"
        onClick={close}
      />
      <div className="radio-handle-card radio-list-card">
        <span className="radio-screwdot tl" aria-hidden />
        <span className="radio-screwdot tr" aria-hidden />
        <span className="radio-screwdot bl" aria-hidden />
        <span className="radio-screwdot br" aria-hidden />

        {joined ? (
          <div className="radio-list-done" role="status">
            <span className="radio-list-stamp">You&apos;re on the list</span>
            <p className="radio-list-fine">
              Watch your inbox — first word from the ranch comes soon.
            </p>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="radio-list-title">
              Join the Latigo List
            </h2>
            <p className="radio-list-sub">
              Hear what is coming from the ranch before it hits the shop.
            </p>
            <form className="radio-list-form" onSubmit={submit} noValidate>
              <input
                type="email"
                name="email"
                className="radio-list-input"
                placeholder="you@example.com"
                aria-label="Email address"
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
                {busy ? "Signing you up…" : "Sign me up"}
              </button>
            </form>
            <button
              type="button"
              className="radio-list-dismiss"
              onClick={onDismiss}
            >
              Not right now
            </button>
            <p className="radio-list-fine">
              Ranch news, new gear, and the odd story. No more than a note a
              week, and you can leave anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
