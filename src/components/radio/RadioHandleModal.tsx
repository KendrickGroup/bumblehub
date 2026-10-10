"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PUBLIC_RADIO_URL } from "@/lib/radio/ranch";
import {
  installPromptReady,
  installWasAccepted,
  runInstallPrompt,
  subscribeInstallPrompt,
} from "@/lib/radio/install-prompt";
import { canNativeShare } from "@/lib/radio/share";
import { RadioShareButton } from "./RadioShareButton";

type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as { standalone?: boolean }).standalone);
  return mq || ios;
}

function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) {
    const other =
      /crios|fxios|edgios|opios|duckduckgo|gsa\/|fban|fbav|instagram|line\//i.test(
        ua,
      );
    return other ? "ios-other" : "ios-safari";
  }
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function IosShareGlyph() {
  return (
    <svg
      className="radio-handle-glyph"
      viewBox="0 0 24 24"
      width="26"
      height="26"
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
      width="26"
      height="26"
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

function ChromeMenuGlyph() {
  return (
    <svg
      className="radio-handle-glyph"
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden
    >
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
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

function GuideStep({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="radio-handle-guide-step">
      <span className="radio-handle-badge">{icon}</span>
      <span className="radio-handle-step-body">{children}</span>
    </li>
  );
}

function IosHomeSteps() {
  return (
    <ol className="radio-handle-guide">
      <GuideStep icon={<IosShareGlyph />}>
        Tap the Share icon
      </GuideStep>
      <GuideStep icon={<IosAddGlyph />}>
        Scroll to Add to Home Screen and tap it
      </GuideStep>
      <GuideStep icon={<LatigoAppIcon />}>
        Tap Add. Latigo Radio gets its own icon
      </GuideStep>
    </ol>
  );
}

function AndroidMenuSteps() {
  return (
    <ol className="radio-handle-guide">
      <GuideStep icon={<ChromeMenuGlyph />}>
        Tap the Chrome menu
      </GuideStep>
      <GuideStep icon={<IosAddGlyph />}>
        Tap Add to Home screen, or Install app
      </GuideStep>
      <GuideStep icon={<LatigoAppIcon />}>
        Latigo Radio gets its own icon
      </GuideStep>
    </ol>
  );
}

export function RadioHandleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [platform] = useState(detectPlatform);
  const [framed] = useState(isFramed);
  const [standalone, setStandalone] = useState(isStandalone);
  const [canInstall, setCanInstall] = useState(installPromptReady);
  const [nativeShare, setNativeShare] = useState(false);

  useEffect(() => {
    setNativeShare(canNativeShare());
    const refresh = () => {
      setCanInstall(installPromptReady());
      if (installWasAccepted() || isStandalone()) setStandalone(true);
    };
    refresh();
    return subscribeInstallPrompt(refresh);
  }, []);

  if (!open) return null;

  const titleId = "radio-handle-title";
  const radioHost = PUBLIC_RADIO_URL.replace(/^https:\/\//, "");
  const carrying = standalone;

  let body: ReactNode;
  if (carrying) {
    body = (
      <p className="radio-handle-lead">Latigo Radio is on this Home Screen.</p>
    );
  } else if (framed) {
    body = (
      <a
        className="radio-handle-install"
        href={PUBLIC_RADIO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open the full Latigo Radio
      </a>
    );
  } else if (platform === "ios-safari") {
    body = (
      <>
        <p className="radio-handle-lead">
          On iPhone, Add to Home Screen is the only way to install.
        </p>
        <IosHomeSteps />
      </>
    );
  } else if (platform === "ios-other") {
    body = (
      <>
        <p className="radio-handle-lead">
          Add to Home Screen only works in Safari. Open {radioHost} in Safari
          first.
        </p>
        <IosHomeSteps />
      </>
    );
  } else if (platform === "android" && canInstall) {
    body = (
      <button
        type="button"
        className="radio-handle-install"
        onClick={() => void runInstallPrompt()}
      >
        Install
      </button>
    );
  } else if (platform === "android") {
    body = (
      <>
        <p className="radio-handle-lead">
          In Chrome, add Latigo Radio from the menu.
        </p>
        <AndroidMenuSteps />
      </>
    );
  } else if (canInstall) {
    body = (
      <button
        type="button"
        className="radio-handle-install"
        onClick={() => void runInstallPrompt()}
      >
        Install
      </button>
    );
  } else {
    body = (
      <p className="radio-handle-lead">Share the radio, or copy the link.</p>
    );
  }

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
        <h2 id={titleId}>
          {carrying ? "You're carrying it." : "Get Latigo Radio on your phone"}
        </h2>
        {body}
        {nativeShare ? (
          <RadioShareButton className="radio-handle-share" />
        ) : null}
        <RadioShareButton
          className="radio-handle-copy"
          label="Copy link"
          mode="copy"
        />
        <button type="button" className="radio-handle-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
