"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Music2 } from "lucide-react";

type Reachability = "idle" | "checking" | "ok" | "fail";

type SpotifyStatus = {
  connected: boolean;
  displayName: string | null;
  lastSyncedAt: string | null;
};

type Props = {
  hasProperty: boolean;
  initialHomeAssistantUrl: string;
  initialSpotify: SpotifyStatus;
};

async function probeReachability(url: string): Promise<boolean> {
  if (!url) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    // Opaque success still means the host answered on this network.
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function formatSynced(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export function IntegrationsSettingsPanel({
  hasProperty,
  initialHomeAssistantUrl,
  initialSpotify,
}: Props) {
  const [haUrl, setHaUrl] = useState(initialHomeAssistantUrl);
  const [savedHaUrl, setSavedHaUrl] = useState(initialHomeAssistantUrl);
  const [haSaving, setHaSaving] = useState(false);
  const [haError, setHaError] = useState<string | null>(null);
  const [haSaved, setHaSaved] = useState(false);
  const [reach, setReach] = useState<Reachability>("idle");

  const [spotify, setSpotify] = useState(initialSpotify);
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  const checkReachability = useCallback(async (url: string) => {
    if (!url) {
      setReach("idle");
      return;
    }
    setReach("checking");
    const ok = await probeReachability(url);
    setReach(ok ? "ok" : "fail");
  }, []);

  useEffect(() => {
    if (savedHaUrl) void checkReachability(savedHaUrl);
  }, [savedHaUrl, checkReachability]);

  const saveHomeAssistant = async () => {
    setHaSaving(true);
    setHaError(null);
    setHaSaved(false);
    try {
      const response = await fetch("/api/settings/home-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: haUrl }),
      });
      const body = (await response.json()) as { error?: string; url?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save");
      }
      const next = body.url ?? "";
      setHaUrl(next);
      setSavedHaUrl(next);
      setHaSaved(true);
      window.setTimeout(() => setHaSaved(false), 1800);
      void checkReachability(next);
    } catch (err) {
      setHaError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setHaSaving(false);
    }
  };

  const disconnectSpotify = async () => {
    if (
      !window.confirm(
        "Disconnect Spotify? Playback controls will stop working until you reconnect.",
      )
    ) {
      return;
    }
    setSpotifyBusy(true);
    setSpotifyError(null);
    try {
      const response = await fetch("/api/settings/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to disconnect");
      }
      setSpotify({
        connected: false,
        displayName: "Spotify",
        lastSyncedAt: null,
      });
    } catch (err) {
      setSpotifyError(
        err instanceof Error ? err.message : "Failed to disconnect",
      );
    } finally {
      setSpotifyBusy(false);
    }
  };

  if (!hasProperty) {
    return (
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Set a default home to configure integrations.
      </div>
    );
  }

  const syncedLabel = formatSynced(spotify.lastSyncedAt);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Integrations
      </h2>

      {/* Home Assistant */}
      <div className="rounded-[20px] bg-white p-6 shadow-sm">
        <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-stone-900">
          Home Assistant
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          The bridge to your lights and devices.
        </p>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-stone-600">
            Home Assistant URL
          </span>
          <input
            type="url"
            value={haUrl}
            onChange={(e) => setHaUrl(e.target.value)}
            placeholder="http://homeassistant.local:8123"
            className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={haSaving}
            onClick={() => void saveHomeAssistant()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
          >
            {haSaving ? "Saving…" : haSaved ? "Saved" : "Save"}
          </button>
          <a
            href={savedHaUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!savedHaUrl}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border px-5 text-sm font-semibold transition ${
              savedHaUrl
                ? "border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
                : "pointer-events-none border-stone-100 bg-stone-50 text-stone-400"
            }`}
            onClick={(e) => {
              if (!savedHaUrl) e.preventDefault();
            }}
          >
            Open Home Assistant
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </a>
        </div>

        {haError && (
          <p className="mt-3 text-sm text-amber-800">{haError}</p>
        )}

        <div className="mt-4 flex items-start gap-2 text-sm">
          {reach === "checking" || reach === "idle" ? (
            <>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
              <span className="text-stone-500">
                {savedHaUrl
                  ? "Checking reachability…"
                  : "Save a URL to check reachability from this device."}
              </span>
            </>
          ) : reach === "ok" ? (
            <>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="text-stone-700">Reachable on this network</span>
            </>
          ) : (
            <>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-400" />
              <span className="text-stone-600">
                Not reachable from this device
                <span className="mt-0.5 block text-xs text-stone-400">
                  Home Assistant is only visible when you&apos;re on the same
                  network.
                </span>
              </span>
            </>
          )}
        </div>

        {/* Reserved for future HA OAuth / device sync — do not remove */}
        <div className="mt-5 rounded-[14px] border border-dashed border-stone-200 bg-[#FAF8F3]/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Coming later
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Connect will link Home Assistant for lights and scenes. For now
            this card only stores your URL.
          </p>
        </div>
      </div>

      {/* Spotify */}
      <div className="rounded-[20px] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F4B400]/15 text-[#E0972B]">
            <Music2 className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-stone-900">
              Spotify
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Music playback for the house.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              spotify.connected ? "bg-emerald-500" : "bg-stone-300"
            }`}
          />
          <p className="text-base font-medium text-stone-800">
            {spotify.connected ? "Connected" : "Not connected"}
          </p>
        </div>
        {spotify.connected && (
          <p className="mt-1 text-sm text-stone-500">
            {spotify.displayName ?? "Spotify"}
            {syncedLabel ? ` · Last synced ${syncedLabel}` : ""}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/api/spotify/login"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800]"
          >
            {spotify.connected ? "Reconnect" : "Connect"}
          </a>
          <button
            type="button"
            disabled={!spotify.connected || spotifyBusy}
            onClick={() => void disconnectSpotify()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
          >
            {spotifyBusy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>

        {spotifyError && (
          <p className="mt-3 text-sm text-amber-800">{spotifyError}</p>
        )}
      </div>
    </section>
  );
}
