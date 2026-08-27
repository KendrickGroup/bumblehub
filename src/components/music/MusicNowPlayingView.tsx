"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ListMusic,
  Music2,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { PlaylistPickerModal } from "@/components/music/PlaylistPickerModal";
import { RetroEqualizer } from "@/components/music/RetroEqualizer";
import {
  RadioLiveBadge,
  SpotifyMark,
} from "@/components/music/AudioSourceMarks";
import type { NowPlayingTrack, PlaybackContext } from "@/lib/music/types";
import { useNowPlaying } from "@/lib/music/use-now-playing";
import {
  formatTrackTime,
  usePlaybackProgress,
} from "@/lib/music/use-playback-progress";
import { useRadioPlayer } from "@/lib/radio/use-radio-player";

const ART_CROSSFADE_MS = 400;

export function MusicNowPlayingView() {
  const { state, busy, toast, localVolume, setVolume, sendCommand } =
    useNowPlaying();
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const radio = useRadioPlayer();
  const radioLive =
    radio.status === "playing" || radio.status === "buffering";

  if (!state && !radioLive) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[#F4B400]/25" />
      </div>
    );
  }

  if ((!state || state.status === "not_connected") && radioLive) {
    return (
      <RadioSourcePanel
        stationName={radio.stationName || "Ranch House Radio"}
        cityLabel={radio.cityLabel || "the dial"}
        buffering={radio.status === "buffering"}
      />
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[#F4B400]/25" />
      </div>
    );
  }

  if (state.status === "not_connected") {
    return (
      <>
        <EmptyState
          action={
            <Link
              href="/api/spotify/login"
              className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] bg-[#F4B400] px-6 text-base font-semibold text-stone-900 transition hover:bg-[#e0a800]"
            >
              Connect
            </Link>
          }
        />
      </>
    );
  }

  const isPlaying = state.status === "playing" && state.track.isPlaying;
  const track = state.status === "playing" ? state.track : null;
  const shuffle = state.shuffle;

  if (!track) {
    return (
      <>
        {toast && <Toast message={toast} />}
        {radioLive ? (
          <RadioSourcePanel
            stationName={radio.stationName || "Ranch House Radio"}
            cityLabel={radio.cityLabel || "the dial"}
            buffering={radio.status === "buffering"}
          />
        ) : (
          <EmptyState
            action={
              <PlaylistsButton
                busy={busy}
                onClick={() => setPlaylistsOpen(true)}
              />
            }
          />
        )}
        <PlaylistPickerModal
          open={playlistsOpen}
          onClose={() => setPlaylistsOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      {toast && <Toast message={toast} />}
      <PlayingLayout
        track={track}
        context={state.status === "playing" ? state.context : null}
        isPlaying={isPlaying}
        shuffle={shuffle}
        busy={busy}
        volume={localVolume}
        onVolumeChange={setVolume}
        onPrevious={() => void sendCommand({ command: "previous" })}
        onPlayPause={() =>
          void sendCommand({ command: isPlaying ? "pause" : "play" })
        }
        onNext={() => void sendCommand({ command: "next" })}
        onShuffleToggle={() =>
          void sendCommand({ command: "setShuffle", shuffle: !shuffle })
        }
        onOpenPlaylists={() => setPlaylistsOpen(true)}
      />
      <PlaylistPickerModal
        open={playlistsOpen}
        onClose={() => setPlaylistsOpen(false)}
      />
    </>
  );
}

function PlayingLayout({
  track,
  context,
  isPlaying,
  shuffle,
  busy,
  volume,
  onVolumeChange,
  onPrevious,
  onPlayPause,
  onNext,
  onShuffleToggle,
  onOpenPlaylists,
}: {
  track: NowPlayingTrack;
  context: PlaybackContext;
  isPlaying: boolean;
  shuffle: boolean;
  busy: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onShuffleToggle: () => void;
  onOpenPlaylists: () => void;
}) {
  const progressMs = usePlaybackProgress(track);
  const durationMs = track.durationMs || 1;
  const progressRatio = Math.min(1, progressMs / durationMs);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col items-center text-center">
      {/*
        Art width caps by column max and by leftover viewport height so the
        full stack (art → volume) fits above the tab bar without scrolling.
        ~30rem reserves EQ, meta, progress, transport, volume, and chrome.
      */}
      <div
        className="flex w-full shrink-0 flex-col items-stretch overflow-visible"
        style={{
          width:
            "min(100%, 36rem, max(12.5rem, calc(100dvh - 30rem)))",
        }}
      >
        <AlbumArtStage artUrl={track.albumArtUrl} trackId={track.id} />
        <div className="relative z-10 mt-5 w-full">
          <RetroEqualizer isPlaying={isPlaying} trackId={track.id} />
        </div>
      </div>

      <div className="relative z-10 mt-6 flex w-full flex-col items-center">
        <div className="flex max-w-full items-start justify-center gap-2.5">
          <SpotifyMark size={20} className="mt-1.5 shrink-0" />
          <h1 className="min-w-0 font-[family-name:var(--font-fraunces)] text-[clamp(1.75rem,4vw,2.125rem)] font-semibold leading-tight tracking-tight text-stone-900">
            {track.name}
          </h1>
        </div>
        {context?.type === "playlist" ? (
          <p className="mt-2 font-[family-name:var(--font-bricolage)] text-sm font-medium text-stone-500">
            Playlist · {context.name}
          </p>
        ) : (
          <p className="mt-2 font-[family-name:var(--font-bricolage)] text-sm font-medium text-stone-500">
            Spotify
          </p>
        )}
        <p className="mt-2 font-[family-name:var(--font-bricolage)] text-lg text-stone-500">
          {track.artists}
        </p>
        {track.album ? (
          <p className="mt-1 text-sm text-stone-400">{track.album}</p>
        ) : null}

        <div className="mt-7 w-full">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200/80"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(durationMs / 1000)}
            aria-valuenow={Math.round(progressMs / 1000)}
            aria-label="Track progress"
          >
            <div
              className="h-full rounded-full bg-[#F4B400] transition-[width] duration-200 ease-linear"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-[family-name:var(--font-bricolage)] text-sm tabular-nums text-stone-500">
            <span>{formatTrackTime(progressMs)}</span>
            <span>{formatTrackTime(track.durationMs)}</span>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-3">
          <TransportButton
            label="Previous"
            disabled={busy}
            onClick={onPrevious}
            className="bg-stone-100 text-stone-600 hover:bg-stone-200"
            size="lg"
          >
            <SkipBack className="h-6 w-6" strokeWidth={2.25} />
          </TransportButton>

          <TransportButton
            label={isPlaying ? "Pause" : "Play"}
            disabled={busy}
            onClick={onPlayPause}
            size="xl"
            className={
              isPlaying
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "bg-[#F4B400] text-stone-900 hover:bg-[#e0a800]"
            }
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" strokeWidth={2.25} fill="currentColor" />
            ) : (
              <Play className="h-7 w-7" strokeWidth={2.25} fill="currentColor" />
            )}
          </TransportButton>

          <TransportButton
            label="Next"
            disabled={busy}
            onClick={onNext}
            className="bg-stone-100 text-stone-600 hover:bg-stone-200"
            size="lg"
          >
            <SkipForward className="h-6 w-6" strokeWidth={2.25} />
          </TransportButton>
        </div>

        <div className="mt-7 flex w-full flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <div className="flex min-h-[52px] flex-1 items-center gap-3">
            <Volume2
              className="h-5 w-5 shrink-0 text-stone-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              disabled={busy}
              aria-label="Volume"
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-[#F4B400] disabled:opacity-50 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#F4B400]"
            />
            <span className="w-9 shrink-0 text-right text-sm font-medium tabular-nums text-stone-600">
              {volume}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 sm:justify-end">
            <button
              type="button"
              aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
              aria-pressed={shuffle}
              disabled={busy}
              onClick={onShuffleToggle}
              className={`flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full transition disabled:opacity-50 ${
                shuffle
                  ? "bg-[#F4B400]/20 text-[#c49200] ring-2 ring-[#F4B400]/50"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              <Shuffle className="h-5 w-5" strokeWidth={2.25} />
            </button>

            <PlaylistsButton busy={busy} onClick={onOpenPlaylists} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AlbumArtStage({
  artUrl,
  trackId,
}: {
  artUrl: string | null;
  trackId: string;
}) {
  const [layers, setLayers] = useState<{
    current: { id: string; url: string | null };
    outgoing: { id: string; url: string | null } | null;
  }>({
    current: { id: trackId, url: artUrl },
    outgoing: null,
  });

  useEffect(() => {
    setLayers((prev) => {
      if (prev.current.id === trackId && prev.current.url === artUrl) {
        return prev;
      }
      return {
        outgoing: prev.current,
        current: { id: trackId, url: artUrl },
      };
    });

    const timer = window.setTimeout(() => {
      setLayers((latest) =>
        latest.outgoing ? { ...latest, outgoing: null } : latest,
      );
    }, ART_CROSSFADE_MS);

    return () => window.clearTimeout(timer);
  }, [trackId, artUrl]);

  const { current, outgoing } = layers;

  return (
    <div className="relative aspect-square w-full min-w-0">
      {/* Soft ambient glow — edges dissolve via radial mask */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2"
        aria-hidden
        style={{
          WebkitMaskImage:
            "radial-gradient(circle at center, black 0%, black 28%, transparent 72%)",
          maskImage:
            "radial-gradient(circle at center, black 0%, black 28%, transparent 72%)",
        }}
      >
        {outgoing?.url ? <GlowLayer url={outgoing.url} fadingOut /> : null}
        {current.url ? <GlowLayer url={current.url} /> : null}
      </div>

      <div className="relative z-10 aspect-square w-full overflow-hidden rounded-[24px] bg-stone-100 shadow-[0_24px_60px_rgba(40,30,10,0.18)]">
        {outgoing ? (
          <ArtLayer
            key={`out-${outgoing.id}`}
            url={outgoing.url}
            className="music-art-out"
          />
        ) : null}
        <ArtLayer
          key={`in-${current.id}`}
          url={current.url}
          className={outgoing ? "music-art-in" : undefined}
        />
      </div>
    </div>
  );
}

function GlowLayer({
  url,
  fadingOut = false,
}: {
  url: string;
  fadingOut?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative blur layer; not LCP content
    <img
      src={url}
      alt=""
      className={`absolute inset-0 h-full w-full scale-110 object-cover blur-[80px] transition-opacity duration-[400ms] ease-out ${
        fadingOut ? "opacity-0" : "opacity-30"
      }`}
    />
  );
}

function ArtLayer({
  url,
  className,
}: {
  url: string | null;
  className?: string;
}) {
  return (
    <div className={`absolute inset-0 ${className ?? ""}`}>
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(max-width: 640px) 90vw, 600px"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-stone-100">
          <Music2 className="h-16 w-16 text-stone-300" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

function RadioSourcePanel({
  stationName,
  cityLabel,
  buffering,
}: {
  stationName: string;
  cityLabel: string;
  buffering: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[600px] rounded-[20px] bg-white px-5 py-6 text-center shadow-sm ring-2 ring-red-500/15">
      <div className="flex items-center justify-center">
        <RadioLiveBadge />
      </div>
      <h2 className="mt-4 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900">
        {stationName}
      </h2>
      <p className="mt-1 font-[family-name:var(--font-bricolage)] text-sm text-stone-500">
        Ranch House Radio · {stationName} — {cityLabel}
      </p>
      {buffering ? (
        <p className="mt-2 text-xs font-medium text-stone-400">Connecting…</p>
      ) : null}
    </div>
  );
}

function EmptyState({ action }: { action: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-[#F4B400]/15 shadow-[0_12px_40px_rgba(244,180,0,0.12)]">
        <Music2 className="h-14 w-14 text-[#F4B400]" strokeWidth={1.5} />
      </div>
      <h1 className="mt-8 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900">
        Nothing playing
      </h1>
      <p className="mt-2 font-[family-name:var(--font-bricolage)] text-base text-stone-500">
        Start something from a playlist to fill the room.
      </p>
      <div className="mt-8">{action}</div>
    </div>
  );
}

function PlaylistsButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex min-h-[52px] shrink-0 items-center gap-2 rounded-[18px] border-2 border-[#F4B400]/40 bg-[#F4B400]/10 px-5 text-sm font-semibold text-stone-900 transition hover:border-[#F4B400] hover:bg-[#F4B400]/20 disabled:opacity-50"
    >
      <ListMusic className="h-5 w-5 text-[#F4B400]" strokeWidth={2} />
      Playlists
    </button>
  );
}

function TransportButton({
  label,
  disabled,
  onClick,
  className,
  size,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className: string;
  size: "lg" | "xl";
  children: React.ReactNode;
}) {
  const sizeClass =
    size === "xl"
      ? "h-16 w-16 min-h-[64px] min-w-[64px]"
      : "h-14 w-14 min-h-[56px] min-w-[56px]";

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-full transition disabled:opacity-50 ${sizeClass} ${className}`}
    >
      {children}
    </button>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      className="mb-6 rounded-[16px] border border-[#F4B400]/40 bg-[#FBF0D0] px-4 py-3 text-sm font-medium text-stone-900 shadow-sm"
      role="status"
    >
      {message}
    </div>
  );
}
