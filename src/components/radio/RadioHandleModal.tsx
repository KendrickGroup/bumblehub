"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { PUBLIC_RADIO_URL } from "@/lib/radio/ranch";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
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
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
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

  return (
    <div className="radio-handle-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="radio-handle-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="radio-handle-card">
        {variant === "app" ? (
          <>
            <p className="radio-handle-kicker">To-Go Radio</p>
            <h2>Take the Ranch House Radio to go</h2>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code for Ranch House Radio" className="radio-handle-qr" />
            ) : (
              <div className="radio-handle-qr radio-handle-qr-wait" />
            )}
            <p className="radio-handle-note">Scan it — the radio rides along.</p>
          </>
        ) : installed ? (
          <>
            <p className="radio-handle-kicker">To-Go Radio</p>
            <h2>You&apos;re carrying it.</h2>
            <p className="radio-handle-note">
              Ranch House Radio is on this Home Screen.
            </p>
          </>
        ) : (
          <>
            <p className="radio-handle-kicker">To-Go Radio</p>
            <h2>Carry the radio home</h2>
            {isIos() ? (
              <ol className="radio-handle-steps">
                <li>
                  <strong>1.</strong> Tap Share
                </li>
                <li>
                  <strong>2.</strong> Add to Home Screen — the radio gets its
                  own app icon
                </li>
              </ol>
            ) : canInstall ? (
              <button
                type="button"
                className="radio-handle-install"
                onClick={() => void install()}
              >
                Install
              </button>
            ) : (
              <p className="radio-handle-note">
                Open the browser menu and tap Install app / Add to Home Screen.
              </p>
            )}
            <button type="button" className="radio-handle-copy" onClick={() => void copyLink()}>
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
