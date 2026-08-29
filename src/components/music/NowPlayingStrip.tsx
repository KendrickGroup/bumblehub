"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import {
  RadioLiveBadge,
  RadioTowerMark,
  SpotifyMark,
} from "@/components/music/AudioSourceMarks";
import type { NowPlayingResponse, PlaybackContext } from "@/lib/music/types";
import { useNowPlaying } from "@/lib/music/use-now-playing";
import { stopRadioPlayback, useRadioPlayer } from "@/lib/radio/use-radio-player";
import { useRadioNowPlaying } from "@/lib/radio/use-radio-now-playing";
import type { RadioNowPlayingTrack } from "@/lib/radio/icy";

type ConnectedState = Extract<
  NowPlayingResponse,
  { status: "idle" } | { status: "playing" }
>;

type NowPlayingStripProps = {
  /** When false and Spotify is not connected, the strip is hidden entirely. */
  allowConnectPrompt?: boolean;
};

function ShellChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-stone-200/60 bg-[#FAF8F3]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </div>
  );
}

export function NowPlayingStrip({
  allowConnectPrompt = true,
}: NowPlayingStripProps) {
  const { state, busy, toast, localVolume, setVolume, sendCommand } =
    useNowPlaying();
  const radio = useRadioPlayer();
  const radioLive =
    radio.status === "playing" || radio.status === "buffering";
  const song = useRadioNowPlaying(
    radio.streamUrl,
    radio.status === "playing",
  );

  // Radio wins the strip during a transition race; the next Spotify poll
  // either pauses Spotify or yields the radio.
  if (radioLive) {
    return (
      <ShellChrome>
        <RadioNowPlaying
          stationName={radio.stationName || "Ranch House Radio"}
          cityLabel={radio.cityLabel || "the dial"}
          buffering={radio.status === "buffering"}
          reconnecting={radio.reconnectAttempt > 0}
          song={song}
        />
      </ShellChrome>
    );
  }

  if (!state) {
    return null;
  }

  if (state.status === "not_connected") {
    if (!allowConnectPrompt) {
      return null;
    }
    return (
      <ShellChrome>
        <div className="flex min-h-[72px] items-center gap-4 rounded-[18px] border-2 border-[#F4B400]/30 bg-white px-5 py-4 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F4B400]/15">
            <Music2 className="h-7 w-7 text-[#F4B400]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-stone-500">Music</p>
            <p className="text-base font-medium text-stone-800">
              Connect Spotify to play music
            </p>
          </div>
          <Link
            href="/api/spotify/login"
            className="min-h-[48px] shrink-0 rounded-[18px] bg-[#F4B400] px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800]"
          >
            Connect
          </Link>
        </div>
      </ShellChrome>
    );
  }

  const connected = state as ConnectedState;
  const isPlaying =
    connected.status === "playing" && connected.track.isPlaying;
  const track = connected.status === "playing" ? connected.track : null;
  const playbackContext =
    connected.status === "playing" ? connected.context : null;
  const contextLine = spotifyContextLine(
    connected.status,
    isPlaying,
    playbackContext,
  );

  return (
    <ShellChrome>
      {toast && (
        <div
          className="mb-3 rounded-[16px] border border-[#F4B400]/40 bg-[#FBF0D0] px-4 py-3 text-sm font-medium text-stone-900 shadow-sm"
          role="status"
        >
          {toast}
        </div>
      )}

      <div
        className={`flex min-h-[88px] flex-col gap-4 rounded-[18px] bg-white px-5 py-4 shadow-sm sm:min-h-[72px] sm:flex-row sm:flex-wrap sm:items-center ${
          isPlaying ? "ring-2 ring-[#F4B400]/40" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
            {track?.albumArtUrl ? (
              <Image
                src={track.albumArtUrl}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music2 className="h-7 w-7 text-stone-400" strokeWidth={1.75} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2">
              <SpotifyMark size={16} className="shrink-0" />
              <span className="truncate text-base font-semibold text-stone-900">
                {track?.name ?? "Nothing playing"}
              </span>
            </p>
            <p className="truncate text-sm text-stone-500">{contextLine}</p>
            {track?.artists ? (
              <p className="truncate text-sm text-stone-500">{track.artists}</p>
            ) : (
              <p className="text-sm text-stone-500">Pick a playlist to start</p>
            )}
          </div>
        </div>

        <VolumeControl
          volume={localVolume}
          disabled={busy}
          onChange={setVolume}
        />

        <PlaybackControls
          busy={busy}
          isPlaying={isPlaying}
          onPrevious={() => void sendCommand({ command: "previous" })}
          onPlayPause={() =>
            void sendCommand({ command: isPlaying ? "pause" : "play" })
          }
          onNext={() => void sendCommand({ command: "next" })}
        />
      </div>
    </ShellChrome>
  );
}

function spotifyContextLine(
  status: "idle" | "playing",
  isPlaying: boolean,
  context: PlaybackContext,
): string {
  if (context?.type === "playlist") return `Playlist · ${context.name}`;
  if (status === "idle") return "Music";
  return isPlaying ? "Now playing" : "Paused";
}

function RadioNowPlaying({
  stationName,
  cityLabel,
  buffering,
  reconnecting,
  song,
}: {
  stationName: string;
  cityLabel: string;
  buffering: boolean;
  reconnecting: boolean;
  song: RadioNowPlayingTrack | null;
}) {
  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-[18px] bg-white px-5 py-4 shadow-sm ring-2 ring-red-500/20 sm:min-h-[72px]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#FBF0D0] text-stone-800">
        {song?.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- iTunes CDN hosts vary
          <img
            key={song.artworkUrl}
            src={song.artworkUrl}
            alt=""
            className="radio-sleeve-photo h-full w-full object-cover"
          />
        ) : (
          <RadioTowerMark size={18} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <RadioLiveBadge />
          <span className="truncate text-base font-semibold text-stone-900">
            {song?.title ?? stationName}
          </span>
        </p>
        {song?.artist ? (
          <p className="truncate text-sm text-stone-500">{song.artist}</p>
        ) : null}
        <p className="truncate text-sm text-stone-500">
          Ranch House Radio · {stationName} — {cityLabel}
        </p>
        {reconnecting ? (
          <p className="text-xs font-medium text-stone-400">reconnecting…</p>
        ) : buffering ? (
          <p className="text-xs font-medium text-stone-400">Connecting…</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Stop radio"
        onClick={stopRadioPlayback}
        className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800"
      >
        <Square className="h-4 w-4" strokeWidth={2.25} fill="currentColor" />
      </button>
    </div>
  );
}

function VolumeControl({
  volume,
  disabled,
  onChange,
}: {
  volume: number;
  disabled: boolean;
  onChange: (volume: number) => void;
}) {
  return (
    <div className="flex min-h-[52px] min-w-[140px] flex-1 items-center gap-3 sm:max-w-[200px] sm:flex-none">
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
        disabled={disabled}
        aria-label="Volume"
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-[#F4B400] disabled:opacity-50 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#F4B400]"
      />
      <span className="w-9 shrink-0 text-right text-sm font-medium tabular-nums text-stone-600">
        {volume}
      </span>
    </div>
  );
}

function PlaybackControls({
  busy,
  isPlaying,
  onPrevious,
  onPlayPause,
  onNext,
}: {
  busy: boolean;
  isPlaying: boolean;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
}) {
  const disabled = busy;

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
      <ControlButton
        label="Previous"
        disabled={disabled}
        onClick={onPrevious}
        className="bg-stone-100 text-stone-600 hover:bg-stone-200"
      >
        <SkipBack className="h-5 w-5" strokeWidth={2.25} />
      </ControlButton>

      <ControlButton
        label={isPlaying ? "Pause" : "Play"}
        disabled={disabled}
        onClick={onPlayPause}
        className={
          isPlaying
            ? "bg-stone-900 text-white hover:bg-stone-800"
            : "bg-[#F4B400] text-stone-900 hover:bg-[#e0a800]"
        }
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" strokeWidth={2.25} fill="currentColor" />
        ) : (
          <Play className="h-5 w-5" strokeWidth={2.25} fill="currentColor" />
        )}
      </ControlButton>

      <ControlButton
        label="Next"
        disabled={disabled}
        onClick={onNext}
        className="bg-stone-100 text-stone-600 hover:bg-stone-200"
      >
        <SkipForward className="h-5 w-5" strokeWidth={2.25} />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
