"use client";

import { useEffect, useRef, useState } from "react";
import { RoundupRopeMark } from "@/components/music/AudioSourceMarks";
import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

const TOAST_MS = 3000;

type LassoKind = "roped" | "duplicate" | "not_found" | "error";

type LassoToast = {
  songKey: string;
  kind: LassoKind;
  text: string;
};

type LassoDebug = {
  songKey: string;
  step: string;
  spotifyStatus: number | null;
  spotifyError: string;
};

const TOAST_COPY: Record<LassoKind, string> = {
  roped: "Roped!",
  duplicate: "Already in your Roundup",
  not_found: "Couldn't find this one on Spotify",
  error: "Couldn't lasso this one just now.",
};

export function NowSpinningPanel({
  track,
  stationLine,
  stationName,
  stationCity,
}: {
  track: RadioNowPlayingTrack;
  stationLine: string;
  stationName: string;
  stationCity: string;
}) {
  const songKey = `${track.title}|${track.artist ?? ""}`;
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [toast, setToast] = useState<LassoToast | null>(null);
  const [debug, setDebug] = useState<LassoDebug | null>(null);
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
    setDebug(null);
    try {
      const response = await fetch("/api/radio/lasso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          artworkUrl: track.artworkUrl,
          stationName,
          stationCity,
        }),
      });
      const body = (await response.json()) as {
        status?: string;
        code?: string;
        error?: string;
        step?: string;
        spotifyStatus?: number | null;
        spotifyError?: string;
      };
      if (body.step || body.spotifyError || body.spotifyStatus != null) {
        setDebug({
          songKey: forSong,
          step: body.step || "unknown",
          spotifyStatus:
            typeof body.spotifyStatus === "number" ? body.spotifyStatus : null,
          spotifyError: body.spotifyError || body.error || `HTTP ${response.status}`,
        });
      }
      if (body.status === "roped") {
        setDebug(null);
        showToast("roped", forSong);
      } else if (body.status === "duplicate") {
        setDebug(null);
        showToast("duplicate", forSong);
      } else if (body.status === "not_found") {
        showToast("not_found", forSong);
      } else if (response.status === 403 || body.code === "reconnect") {
        showToast("error", forSong);
      } else {
        showToast("error", forSong, body.error);
      }
    } catch (error) {
      setDebug({
        songKey: forSong,
        step: "save",
        spotifyStatus: null,
        spotifyError:
          error instanceof Error ? error.message : "Network error",
      });
      showToast("error", forSong);
    } finally {
      setSavingFor((current) => (current === forSong ? null : current));
    }
  };

  const saving = savingFor === songKey;
  const visibleToast = toast?.songKey === songKey ? toast : null;
  const visibleDebug = debug?.songKey === songKey ? debug : null;

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
          aria-label="Lasso, save this song to The Roundup"
          className={`radio-lasso ${saving ? "is-pressed" : ""}`}
        >
          <RoundupRopeMark size={22} />
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
      {visibleDebug ? (
        <p className="mt-2 font-mono text-[10px] leading-snug break-all text-stone-500">
          {visibleDebug.step}
          {" · "}
          {visibleDebug.spotifyStatus ?? "—"}
          {" · "}
          {visibleDebug.spotifyError}
        </p>
      ) : null}
    </div>
  );
}
