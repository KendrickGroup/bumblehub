"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { PUBLIC_RADIO_URL } from "@/lib/radio/ranch";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

function IosShareGlyph() {
  return (
    <svg
      className="radio-handle-glyph"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.4 8.6H6.7A2.2 2.2 0 0 0 4.5 10.8v8.5A2.2 2.2 0 0 0 6.7 21.5h10.6a2.2 2.2 0 0 0 2.2-2.2v-8.5a2.2 2.2 0 0 0-2.2-2.2h-1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.8V3.6M8.4 7.1 12 3.6l3.6 3.5"
      />
    </svg>
  );
}

function IosAddGlyph() {
  return (
    <svg
      className="radio-handle-glyph"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <rect
        x="4.2"
        y="4.2"
        width="15.6"
        height="15.6"
        rx="3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 8.2v7.6M8.2 12h7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LatigoAppIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/radio/icon-192.png"
      alt=""
      aria-hidden
      className="radio-handle-appicon"
    />
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="radio-handle-step">
      <span className="radio-handle-num">{n}.</span>
      <span className="radio-handle-step-body">{children}</span>
    </li>
  );
}

function IosHomeSteps({ from }: { from: 3 | 2 }) {
  const share = from;
  const add = from + 1;
  const done = from + 2;
  return (
    <ol className="radio-handle-steps" start={from}>
      <Step n={share}>
        Tap the Share button
        <IosShareGlyph />
      </Step>
      <Step n={add}>
        Scroll down and tap Add to Home Screen
        <IosAddGlyph />
      </Step>
      <Step n={done}>
        Tap Add — Latigo Radio gets its own app icon
        <LatigoAppIcon />
      </Step>
    </ol>
  );
}

export function RadioHandleModal({
  open,
  onClose,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  variant: "app" | "public";
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [framed, setFramed] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    try {
      setFramed(window.self !== window.top);
    } catch {
      setFramed(true);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open || variant !== "app") return;
    let cancelled = false;
    void QRCode.toDataURL(PUBLIC_RADIO_URL, {
      margin: 1,
      width: 280,
      color: { dark: "#3E2F20", light: "#FAF8F3" },
    }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, variant]);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_RADIO_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const install = async () => {
    const prompt = promptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    promptRef.current = null;
    setCanInstall(false);
  };

  const titleId = "radio-handle-title";

  return (
    <div
      className="radio-handle-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="radio-handle-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="radio-handle-card">
        {variant === "app" ? (
          <>
            <h2 id={titleId}>Get Latigo Radio on your phone</h2>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code for Latigo Radio"
                className="radio-handle-qr"
              />
            ) : (
              <div className="radio-handle-qr radio-handle-qr-wait" />
            )}
            <p className="radio-handle-caption">
              <span className="radio-handle-num">1.</span>
              Point your phone&apos;s camera here
            </p>
            <ol className="radio-handle-steps" start={2}>
              <Step n={2}>Tap Open in Safari when it appears</Step>
              <Step n={3}>
                Tap the Share button
                <IosShareGlyph />
              </Step>
              <Step n={4}>
                Scroll down and tap Add to Home Screen
                <IosAddGlyph />
              </Step>
              <Step n={5}>
                Tap Add — Latigo Radio gets its own app icon
                <LatigoAppIcon />
              </Step>
            </ol>
            <p className="radio-handle-footnote">
              On Android, tap Install when your browser offers it.
            </p>
          </>
        ) : installed ? (
          <>
            <h2 id={titleId}>You&apos;re carrying it.</h2>
            <p className="radio-handle-note">
              Latigo Radio is on this Home Screen.
            </p>
          </>
        ) : framed ? (
          <>
            <h2 id={titleId}>Latigo Radio</h2>
            <a
              className="radio-handle-install"
              href={PUBLIC_RADIO_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the full Latigo Radio
            </a>
          </>
        ) : (
          <>
            <h2 id={titleId}>Get Latigo Radio on your phone</h2>
            {isIos() ? (
              <IosHomeSteps from={3} />
            ) : (
              <>
                <p className="radio-handle-note">
                  Tap Install when your browser offers it.
                </p>
                {canInstall ? (
                  <button
                    type="button"
                    className="radio-handle-install"
                    onClick={() => void install()}
                  >
                    Install
                  </button>
                ) : null}
              </>
            )}
            <button
              type="button"
              className="radio-handle-copy"
              onClick={() => void copyLink()}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </>
        )}
        <button type="button" className="radio-handle-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
