"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ListMusic,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { MUSIC_UPDATED_EVENT } from "@/lib/music/events";
import type { NowPlayingResponse, PlaybackCommand } from "@/lib/music/types";
import { PlaylistPickerModal } from "@/components/music/PlaylistPickerModal";

const POLL_MS = 5000;
const REFRESH_AFTER_COMMAND_MS = 350;

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
  const [state, setState] = useState<NowPlayingResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState(50);
  const [toast, setToast] = useState<string | null>(null);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/music/now-playing", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as NowPlayingResponse;
      setState(body);
      if (body.status === "idle" || body.status === "playing") {
        if (body.volume != null) {
          setLocalVolume(body.volume);
        }
      }
    } catch {
      // Keep last known state on transient errors.
    }
  }, []);

  const sendCommand = useCallback(
    async (
      command: PlaybackCommand["command"],
      payload?: { volume?: number },
    ) => {
      setBusy(true);
      try {
        const body: Record<string, unknown> = { command };
        if (payload?.volume != null) {
          body.volume = payload.volume;
        }
        const response = await fetch("/api/music/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let code: string | undefined;
          let errorMessage: string | undefined;
          try {
            const errBody = (await response.json()) as {
              code?: string;
              error?: string;
            };
            code = errBody.code;
            errorMessage = errBody.error;
          } catch {
            // ignore parse errors
          }

          if (code === "NO_ACTIVE_DEVICE" || response.status === 404) {
            showToast("Open Spotify on a device to start playback.");
          } else if (errorMessage) {
            showToast(errorMessage);
          }
          return;
        }

        await load();
        window.setTimeout(load, REFRESH_AFTER_COMMAND_MS);
      } finally {
        setBusy(false);
      }
    },
    [load, showToast],
  );

  const setVolume = useCallback(
    (volume: number) => {
      setLocalVolume(volume);
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      volumeDebounceRef.current = setTimeout(() => {
        void sendCommand("setVolume", { volume });
      }, 350);
    },
    [sendCommand],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onMusicUpdated = () => {
      load();
      window.setTimeout(load, REFRESH_AFTER_COMMAND_MS);
    };
    window.addEventListener(MUSIC_UPDATED_EVENT, onMusicUpdated);
    return () => {
      clearInterval(id);
      window.removeEventListener(MUSIC_UPDATED_EVENT, onMusicUpdated);
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [load]);

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
            <p className="text-sm text-stone-500">
              {connected.status === "idle"
                ? "Music"
                : isPlaying
                  ? "Now playing"
                  : "Paused"}
            </p>
            <p className="truncate text-base font-semibold text-stone-900">
              {track?.name ?? "Nothing playing"}
            </p>
            {track?.artists ? (
              <p className="truncate text-sm text-stone-500">{track.artists}</p>
            ) : (
              <p className="text-sm text-stone-500">Pick a playlist to start</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPlaylistsOpen(true)}
            disabled={busy}
            className="flex min-h-[52px] shrink-0 items-center gap-2 rounded-[18px] border-2 border-[#F4B400]/40 bg-[#F4B400]/10 px-4 text-sm font-semibold text-stone-900 transition hover:border-[#F4B400] hover:bg-[#F4B400]/20 disabled:opacity-50"
          >
            <ListMusic className="h-5 w-5 text-[#F4B400]" strokeWidth={2} />
            <span className="hidden sm:inline">Playlists</span>
          </button>
        </div>

        <VolumeControl
          volume={localVolume}
          disabled={busy}
          onChange={setVolume}
        />

        <PlaybackControls
          busy={busy}
          isPlaying={isPlaying}
          onPrevious={() => void sendCommand("previous")}
          onPlayPause={() =>
            void sendCommand(isPlaying ? "pause" : "play")
          }
          onNext={() => void sendCommand("next")}
        />
      </div>

      <PlaylistPickerModal
        open={playlistsOpen}
        onClose={() => setPlaylistsOpen(false)}
      />
    </ShellChrome>
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
