"use client";

/**
 * Where the ROUNDUP key points. Paste a share link, ?si= and all — the token is
 * stripped before it is stored. Clearing the field hands the key back to the
 * NEXT_PUBLIC_ROUNDUP_PLAYLIST_URL fallback, and with neither set the key hides.
 */

import { useState } from "react";
import { cleanRoundupPlaylistUrl } from "@/lib/radio/roundup-playlist";
import { notifyRadioStationsChanged } from "@/lib/radio/types";
import { SettingsRow } from "./SettingsRows";

type Props = {
  hasProperty: boolean;
  initialUrl: string;
  envFallback: string;
};

export function RoundupPlaylistField({
  hasProperty,
  initialUrl,
  envFallback,
}: Props) {
  const [value, setValue] = useState(initialUrl);
  const [saved, setSaved] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = async () => {
    if (!hasProperty || busy) return;
    const raw = value.trim();
    const clean = raw ? cleanRoundupPlaylistUrl(raw) : "";
    if (clean === null) {
      setError("Paste a Spotify playlist link.");
      return;
    }
    if (clean === saved) {
      setError(null);
      setValue(clean);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/settings/roundup-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean }),
      });
      const body = (await response.json()) as {
        roundup_playlist_url?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not save.");
        return;
      }
      const next = body.roundup_playlist_url ?? clean;
      setSaved(next);
      setValue(next);
      setError(null);
      notifyRadioStationsChanged();
    } catch {
      setError("Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const hint = saved
    ? "The ROUNDUP key opens this"
    : envFallback
      ? "Using the env fallback"
      : "Unset — the ROUNDUP key stays hidden";

  return (
    <>
      <SettingsRow title="Roundup playlist URL" hint={hint}>
        <input
          type="url"
          value={value}
          disabled={!hasProperty}
          placeholder="https://open.spotify.com/playlist/…"
          aria-label="Roundup playlist URL"
          aria-invalid={Boolean(error)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            if (error) setError(null);
          }}
          onBlur={() => void persist()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void persist();
            }
          }}
          className="settings-label-input settings-url-input"
        />
      </SettingsRow>
      {error ? (
        <p className="settings-hint settings-hint-error">{error}</p>
      ) : (
        <p className="settings-hint">
          Paste the Spotify share link. The ?si= token is dropped on save.
          {envFallback && !saved
            ? ` Falling back to ${envFallback} until this is set.`
            : ""}
        </p>
      )}
    </>
  );
}
