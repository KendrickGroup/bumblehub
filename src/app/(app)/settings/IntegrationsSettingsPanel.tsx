"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Music2 } from "lucide-react";
import { HOME_ASSISTANT_CORS_YAML } from "@/lib/home-assistant/cors";
import {
  haHello,
  HomeAssistantHttpError,
  HomeAssistantUnreachableError,
  invalidateHomeAssistantClientConfig,
} from "@/lib/home-assistant/client";

type Reachability = "idle" | "checking" | "ok" | "fail";

type SpotifyStatus = {
  connected: boolean;
  displayName: string | null;
  lastSyncedAt: string | null;
};

type Props = {
  hasProperty: boolean;
  initialHomeAssistantUrl: string;
  initialHasToken: boolean;
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
  initialHasToken,
  initialSpotify,
}: Props) {
  const [haUrl, setHaUrl] = useState(initialHomeAssistantUrl);
  const [savedHaUrl, setSavedHaUrl] = useState(initialHomeAssistantUrl);
  const [haSaving, setHaSaving] = useState(false);
  const [haError, setHaError] = useState<string | null>(null);
  const [haSaved, setHaSaved] = useState(false);
  const [reach, setReach] = useState<Reachability>("idle");

  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(initialHasToken);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [copiedCors, setCopiedCors] = useState(false);

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

  const saveHomeAssistantUrl = async () => {
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
      invalidateHomeAssistantClientConfig();
      window.setTimeout(() => setHaSaved(false), 1800);
      void checkReachability(next);
    } catch (err) {
      setHaError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setHaSaving(false);
    }
  };

  const saveToken = async () => {
    setTokenSaving(true);
    setHaError(null);
    setTokenSaved(false);
    try {
      const response = await fetch("/api/settings/home-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json()) as {
        error?: string;
        hasToken?: boolean;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save token");
      }
      setHasToken(Boolean(body.hasToken));
      setToken("");
      setTokenSaved(true);
      invalidateHomeAssistantClientConfig();
      window.setTimeout(() => setTokenSaved(false), 1800);
    } catch (err) {
      setHaError(err instanceof Error ? err.message : "Failed to save token");
    } finally {
      setTokenSaving(false);
    }
  };

  const disconnectToken = async () => {
    if (!window.confirm("Disconnect Home Assistant? Scene device actions will stop working until you paste a new token.")) {
      return;
    }
    setTokenSaving(true);
    setHaError(null);
    try {
      const response = await fetch("/api/settings/home-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to disconnect");
      }
      setHasToken(false);
      setToken("");
      setTestMessage(null);
      invalidateHomeAssistantClientConfig();
    } catch (err) {
      setHaError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setTokenSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestError(null);
    setTestMessage(null);
    const url = savedHaUrl || haUrl.trim();
    if (!url) {
      setTestError("Save a Home Assistant URL first.");
      setTesting(false);
      return;
    }

    let accessToken = token.trim();
    if (!accessToken) {
      try {
        const response = await fetch("/api/home-assistant/client-config", {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          token?: string | null;
          error?: string;
        };
        if (!response.ok || !body.token) {
          throw new Error(
            body.error ?? "Save a long-lived access token first.",
          );
        }
        accessToken = body.token;
      } catch (err) {
        setTestError(
          err instanceof Error ? err.message : "Could not load the token.",
        );
        setTesting(false);
        return;
      }
    }

    try {
      const hello = await haHello(url, accessToken);
      setTestMessage(
        hello.version
          ? `Connected · Home Assistant ${hello.version}`
          : `Connected · ${hello.message}`,
      );
    } catch (err) {
      if (err instanceof HomeAssistantHttpError) {
        setTestError(err.message);
      } else if (err instanceof HomeAssistantUnreachableError) {
        setTestError(
          reach === "ok"
            ? "Reached the host, but the API call was blocked. Add the CORS block below to configuration.yaml and restart Home Assistant."
            : "Can't reach Home Assistant from this device. You need to be on the house network.",
        );
      } else {
        setTestError(
          err instanceof Error ? err.message : "Connection test failed",
        );
      }
    } finally {
      setTesting(false);
    }
  };

  const copyCors = async () => {
    try {
      await navigator.clipboard.writeText(HOME_ASSISTANT_CORS_YAML);
      setCopiedCors(true);
      window.setTimeout(() => setCopiedCors(false), 1600);
    } catch {
      setCopiedCors(false);
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

      <div className="rounded-[20px] bg-white p-6 shadow-sm">
        <h3 className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-stone-900">
          Home Assistant
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          The bridge to your lights and devices. Calls run from this device on
          the house network — Vercel never talks to Home Assistant.
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
            onClick={() => void saveHomeAssistantUrl()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
          >
            {haSaving ? "Saving…" : haSaved ? "Saved" : "Save URL"}
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

        <div className="mt-6 border-t border-stone-100 pt-5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                hasToken ? "bg-emerald-500" : "bg-stone-300"
              }`}
            />
            <p className="text-base font-medium text-stone-800">
              {hasToken ? "Access token saved" : "Not connected"}
            </p>
          </div>

          <p className="mt-3 text-sm text-stone-600">
            In Home Assistant, open your profile (bottom-left) →{" "}
            <strong className="font-semibold text-stone-800">Security</strong>{" "}
            → Long-lived access tokens. Create one, then paste it here. It is
            stored server-side for this hive and sent back to this device when
            scenes run.
          </p>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-600">
              Long-lived access token
            </span>
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                hasToken ? "Paste a new token to replace" : "eyJhbGciOiJIUzI1NiI…"
              }
              className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 font-mono text-sm text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={tokenSaving || !token.trim()}
              onClick={() => void saveToken()}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
            >
              {tokenSaving
                ? "Saving…"
                : tokenSaved
                  ? "Saved"
                  : hasToken
                    ? "Replace token"
                    : "Save token"}
            </button>
            <button
              type="button"
              disabled={testing || (!hasToken && !token.trim())}
              onClick={() => void testConnection()}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              disabled={!hasToken || tokenSaving}
              onClick={() => void disconnectToken()}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
            >
              Disconnect
            </button>
          </div>

          {testMessage && (
            <p className="mt-3 text-sm text-emerald-800">{testMessage}</p>
          )}
          {testError && (
            <p className="mt-3 text-sm text-amber-800">{testError}</p>
          )}
        </div>

        <div className="mt-6 rounded-[14px] border border-stone-200 bg-[#FAF8F3]/80 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                CORS — add to configuration.yaml
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Home Assistant must allow this site to call its API from the
                browser. Add this, then restart Home Assistant.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyCors()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              {copiedCors ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-[10px] bg-stone-900 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-stone-100">
            {HOME_ASSISTANT_CORS_YAML}
          </pre>
        </div>
      </div>

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
