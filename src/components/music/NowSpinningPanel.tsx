"use client";

import { useEffect, useRef, useState } from "react";
import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

const TOAST_MS = 3000;

type LassoKind = "roped" | "duplicate" | "not_found" | "reconnect" | "error";

type LassoToast = {
  songKey: string;
  kind: LassoKind;
  text: string;
};

const TOAST_COPY: Record<LassoKind, string> = {
  roped: "Roped! Saved to The Latigo Roundup",
  duplicate: "Already in your Roundup",
  not_found: "Couldn't find this one on Spotify",
  reconnect: "Reconnect Spotify in Settings to enable saving",
  error: "Couldn't lasso this one just now.",
};

export function NowSpinningPanel({
  track,
  stationLine,
}: {
  track: RadioNowPlayingTrack;
  stationLine: string;
}) {
  const songKey = `${track.title}|${track.artist ?? ""}`;
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [toast, setToast] = useState<LassoToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (kind: LassoKind, forSong: string, text?: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, songKey: forSong, text: text ?? TOAST_COPY[kind] });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const onLasso = async () => {
    if (savingFor === songKey) return;
    const forSong = songKey;
    setSavingFor(forSong);
    try {
      const response = await fetch("/api/radio/lasso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
        }),
      });
      const body = (await response.json()) as {
        status?: string;
        code?: string;
        error?: string;
      };
      if (response.status === 403 || body.code === "reconnect") {
        showToast("reconnect", forSong);
        return;
      }
      if (body.status === "roped") showToast("roped", forSong);
      else if (body.status === "duplicate") showToast("duplicate", forSong);
      else if (body.status === "not_found") showToast("not_found", forSong);
      else showToast("error", forSong, body.error);
    } catch {
      showToast("error", forSong);
    } finally {
      setSavingFor((current) => (current === forSong ? null : current));
    }
  };

  const saving = savingFor === songKey;
  const visibleToast = toast?.songKey === songKey ? toast : null;

  return (
    <div className="radio-spin relative mt-[18px] rounded-[12px] px-4 py-3">
      <span className="radio-spin-tag">NOW SPINNING</span>
      <div className="flex items-center gap-4">
        <div className="relative h-[84px] w-[106px] shrink-0">
          <div className="radio-vinyl" aria-hidden />
          <div className="relative z-[2] h-[84px] w-[84px] overflow-hidden rounded-[6px] shadow-[0_4px_10px_rgba(0,0,0,.35)]">
            {track.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- iTunes CDN hosts vary
              <img
                key={track.artworkUrl}
                src={track.artworkUrl}
                alt=""
                className="radio-sleeve-photo h-full w-full object-cover"
              />
            ) : (
              <div className="radio-sleeve-kraft h-full w-full" aria-hidden />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate text-[17px] font-extrabold text-[#241A12]">
            {track.title}
          </p>
          {track.artist ? (
            <p className="mt-[3px] font-[family-name:var(--font-elite)] text-[13px] text-[#6B5636]">
              {track.artist}
            </p>
          ) : null}
          <p className="mt-[7px] text-[10px] font-bold tracking-[0.2em] text-[#A08A5F] uppercase">
            {stationLine}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onLasso()}
          aria-label="Lasso, save this song to The Latigo Roundup"
          className={`radio-lasso ${saving ? "is-pressed" : ""}`}
        >
          <RopeLoopIcon />
          <span>LASSO</span>
        </button>
      </div>
      {visibleToast ? (
        <p
          key={`${visibleToast.kind}|${visibleToast.text}`}
          className="radio-lasso-toast mt-2 flex items-center gap-1.5 font-[family-name:var(--font-elite)] text-[13px] text-[#3E2A1E]"
          role="status"
        >
          {visibleToast.kind === "roped" ? (
            <span className="font-extrabold text-[#6B8F3A]" aria-hidden>
              ✓
            </span>
          ) : null}
          {visibleToast.text}
        </p>
      ) : null}
    </div>
  );
}

function RopeLoopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8.5 12.5c0-3.2 2.4-5.6 5.4-5.6 3 0 5.1 2.2 5.1 5.1 0 3.4-2.7 5.8-6.1 5.8-2.6 0-4.4-1.3-5.4-3.2" />
      <path d="M8.2 12.8c-1.6 1.2-3.4 1.4-4.7.4" />
      <path d="M4.2 11.6c.4 1.6-.2 3.3-1.4 4.2" />
    </svg>
  );
}
