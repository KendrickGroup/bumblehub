"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ListMusic, Music2, X } from "lucide-react";
import type { DevicesResponse, MusicPlaylist, PlaylistsResponse } from "@/lib/music/types";
import { notifyMusicUpdated } from "@/lib/music/events";
import { stopRadioForSpotifyPlayback } from "@/lib/radio/use-radio-player";

type PlaylistPickerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PlaylistPickerModal({ open, onClose }: PlaylistPickerModalProps) {
  const [playlists, setPlaylists] = useState<MusicPlaylist[] | null>(null);
  const [devices, setDevices] = useState<DevicesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "not_connected" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const [playlistsRes, devicesRes] = await Promise.all([
        fetch("/api/music/playlists", { cache: "no-store" }),
        fetch("/api/music/devices", { cache: "no-store" }),
      ]);

      if (!playlistsRes.ok) {
        throw new Error("Could not load playlists");
      }

      const playlistsBody = (await playlistsRes.json()) as PlaylistsResponse;
      const devicesBody = devicesRes.ok
        ? ((await devicesRes.json()) as DevicesResponse)
        : null;

      if (playlistsBody.status === "not_connected") {
        setStatus("not_connected");
        setPlaylists(null);
        return;
      }

      setPlaylists(playlistsBody.playlists);
      setDevices(devicesBody);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const playPlaylist = async (playlistId: string) => {
    setPlayingId(playlistId);
    setError(null);
    try {
      stopRadioForSpotifyPlayback();
      const response = await fetch("/api/music/playlists/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to start playlist");
      }
      notifyMusicUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start playlist");
    } finally {
      setPlayingId(null);
    }
  };

  if (!open) return null;

  const targetDevice =
    devices?.status === "ok"
      ? devices.devices.find((d) => d.isActive) ?? devices.devices[0]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="music-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4B400]/20">
              <Music2 className="h-5 w-5 text-[#F4B400]" strokeWidth={2} />
            </div>
            <div>
              <h2
                id="music-modal-title"
                className="text-lg font-semibold text-stone-900"
              >
                Music
              </h2>
              {targetDevice && (
                <p className="text-xs text-stone-500">
                  Playing on {targetDevice.name}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {status === "loading" && (
            <p className="py-8 text-center text-sm text-stone-500">
              Loading playlists…
            </p>
          )}

          {status === "not_connected" && (
            <div className="space-y-4 py-6 text-center">
              <p className="text-sm text-stone-600">
                Connect Spotify to browse your playlists.
              </p>
              <Link
                href="/api/spotify/login"
                className="inline-flex min-h-[48px] items-center rounded-[18px] bg-[#F4B400] px-6 text-sm font-semibold text-stone-900"
              >
                Connect Spotify
              </Link>
            </div>
          )}

          {status === "error" && (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          )}

          {status === "ready" && playlists && playlists.length === 0 && (
            <p className="py-8 text-center text-sm text-stone-500">
              No playlists found on your Spotify account.
            </p>
          )}

          {status === "ready" && playlists && playlists.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {playlists.map((playlist) => (
                <li key={playlist.id}>
                  <button
                    type="button"
                    disabled={playingId !== null}
                    onClick={() => playPlaylist(playlist.id)}
                    className="flex w-full flex-col overflow-hidden rounded-[18px] bg-[#FAF8F3] text-left transition hover:ring-2 hover:ring-[#F4B400]/50 disabled:opacity-50"
                  >
                    <div className="relative aspect-square w-full bg-stone-100">
                      {playlist.imageUrl ? (
                        <Image
                          src={playlist.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="160px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ListMusic className="h-10 w-10 text-stone-300" />
                        </div>
                      )}
                      {playingId === playlist.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/40">
                          <span className="text-xs font-medium text-white">
                            Starting…
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium text-stone-900">
                        {playlist.name}
                      </p>
                      {playlist.trackCount != null && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          {playlist.trackCount} tracks
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && status === "ready" && (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
