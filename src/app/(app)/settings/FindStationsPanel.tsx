"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { StationTestButton } from "@/components/radio/StationTestButton";
import {
  RADIO_GENRES,
  RANCH_SUGGESTIONS,
  cityLabelFromResult,
  displayTags,
  resultAlreadyOnDial,
  resultPlace,
  suggestionAlreadyOnDial,
  type RadioGenreId,
  type RanchSuggestion,
} from "@/lib/radio/browser";
import type { RadioSearchResult, RadioStation } from "@/lib/radio/types";

type Props = {
  stations: RadioStation[];
  atVisibleCap: boolean;
  onAdd: (input: {
    city_label: string;
    station_name: string;
    stream_url: string;
    call_sign?: string;
    frequency?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const SEARCH_DEBOUNCE_MS = 400;

type SuggestionState = {
  status: "idle" | "loading" | "ready" | "offline";
  result: RadioSearchResult | null;
};

export function FindStationsPanel({ stations, atVisibleCap, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<RadioGenreId | null>(null);
  const [results, setResults] = useState<RadioSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionState>>(
    {},
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGen = useRef(0);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const runSearch = useCallback(async (url: string, gen: number) => {
    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = (await response.json()) as {
        results?: RadioSearchResult[];
        error?: string;
      };
      if (gen !== searchGen.current) return;
      if (!response.ok) throw new Error(body.error ?? "Search failed");
      setResults(body.results ?? []);
    } catch (err) {
      if (gen !== searchGen.current) return;
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      if (gen === searchGen.current) setSearching(false);
    }
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setGenre(null);
    const q = value.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) {
      searchGen.current += 1;
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const gen = ++searchGen.current;
    searchTimer.current = setTimeout(() => {
      void runSearch(`/api/radio/search?q=${encodeURIComponent(q)}`, gen);
    }, SEARCH_DEBOUNCE_MS);
  };

  const onGenre = (id: RadioGenreId) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery("");
    if (genre === id) {
      setGenre(null);
      searchGen.current += 1;
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setGenre(id);
    void runSearch(
      `/api/radio/search?genre=${encodeURIComponent(id)}`,
      ++searchGen.current,
    );
  };

  const resolveSuggestion = async (suggestion: RanchSuggestion) => {
    if (suggestionAlreadyOnDial(suggestion, stations)) return;
    setSuggestions((prev) => ({
      ...prev,
      [suggestion.id]: { status: "loading", result: null },
    }));
    try {
      const response = await fetch(
        `/api/radio/search?suggest=1&q=${encodeURIComponent(suggestion.query)}&city=${encodeURIComponent(suggestion.city)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        result?: RadioSearchResult | null;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Search failed");
      const result = body.result ?? null;
      setSuggestions((prev) => ({
        ...prev,
        [suggestion.id]: {
          status: result ? "ready" : "offline",
          result,
        },
      }));
    } catch {
      setSuggestions((prev) => ({
        ...prev,
        [suggestion.id]: { status: "offline", result: null },
      }));
    }
  };

  const addResult = async (
    key: string,
    result: RadioSearchResult,
    cityFallback?: string,
  ) => {
    if (resultAlreadyOnDial(result, stations)) return;
    setAddingKey(key);
    await onAdd({
      city_label: cityFallback || cityLabelFromResult(result),
      station_name: result.name.slice(0, 80),
      stream_url: result.streamUrl,
    });
    setAddingKey(null);
  };

  const showingResults =
    query.trim().length >= 2 || genre !== null;

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-[#F4B400]/50 sm:w-auto sm:px-5"
      >
        Find stations
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      {open ? (
        <div className="mt-5 space-y-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Suggested for the ranch
            </p>
            <ul className="space-y-2">
              {RANCH_SUGGESTIONS.map((suggestion) => {
                const state = suggestions[suggestion.id];
                const onDial =
                  suggestionAlreadyOnDial(suggestion, stations) ||
                  (state?.result
                    ? resultAlreadyOnDial(state.result, stations)
                    : false);
                return (
                  <li
                    key={suggestion.id}
                    className="rounded-[14px] border border-stone-100 bg-[#FAF8F3] px-3 py-2.5"
                  >
                    <button
                      type="button"
                      disabled={onDial}
                      onClick={() => void resolveSuggestion(suggestion)}
                      className="w-full text-left disabled:cursor-default"
                    >
                      <p className="text-sm font-semibold text-stone-900">
                        {suggestion.name}
                      </p>
                      <p className="text-xs text-stone-500">{suggestion.city}</p>
                    </button>
                    {onDial ? (
                      <p className="mt-2 text-xs font-medium text-stone-500">
                        Already on your dial
                      </p>
                    ) : state?.status === "loading" ? (
                      <p className="mt-2 text-xs text-stone-500">Finding a stream…</p>
                    ) : state?.status === "offline" ? (
                      <p className="mt-2 text-xs font-medium text-stone-600">
                        Off the air — try search
                      </p>
                    ) : state?.status === "ready" && state.result ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StationTestButton
                          testKey={`suggest:${suggestion.id}`}
                          url={state.result.streamUrl}
                        />
                        <AddToDialButton
                          busy={addingKey === suggestion.id}
                          atVisibleCap={atVisibleCap}
                          onClick={() =>
                            void addResult(
                              suggestion.id,
                              state.result!,
                              suggestion.city,
                            )
                          }
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-stone-400">
                        Tap to find a live stream
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Browse a genre
            </p>
            <div className="flex flex-wrap gap-2">
              {RADIO_GENRES.map((chip) => {
                const active = genre === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => onGenre(chip.id)}
                    className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold transition ${
                      active
                        ? "bg-[#F4B400] text-stone-900"
                        : "border border-stone-200 bg-white text-stone-700 hover:border-[#F4B400]/50"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Search
            </p>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400"
                strokeWidth={2}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Station name"
                className="min-h-[52px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] py-3 pr-4 pl-10 text-base text-stone-800 placeholder:text-stone-400 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
              />
            </div>
          </div>

          {searching ? (
            <p className="text-sm text-stone-500">Searching…</p>
          ) : null}
          {searchError ? (
            <p className="text-sm font-medium text-red-700">{searchError}</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {results.map((result) => {
                const onDial = resultAlreadyOnDial(result, stations);
                const place = resultPlace(result);
                const tags = displayTags(result);
                return (
                  <li
                    key={result.stationuuid}
                    className="flex flex-wrap items-center gap-2 rounded-[14px] border border-stone-100 bg-[#FAF8F3] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {result.name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {place || "Unknown location"}
                        {result.bitrate ? ` · ${result.bitrate} kbps` : ""}
                      </p>
                      {tags.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-stone-600 ring-1 ring-stone-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {onDial ? (
                      <span className="text-xs font-medium text-stone-500">
                        Already on your dial
                      </span>
                    ) : (
                      <>
                        <StationTestButton
                          testKey={`find:${result.stationuuid}`}
                          url={result.streamUrl}
                        />
                        <AddToDialButton
                          busy={addingKey === result.stationuuid}
                          atVisibleCap={atVisibleCap}
                          onClick={() =>
                            void addResult(result.stationuuid, result)
                          }
                        />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : showingResults && !searching && !searchError ? (
            <p className="text-sm text-stone-500">
              No https streams found. Try another name or genre.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddToDialButton({
  busy,
  atVisibleCap,
  onClick,
}: {
  busy: boolean;
  atVisibleCap: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      title={
        atVisibleCap
          ? "The dial holds 10 — hide one to add another."
          : undefined
      }
      className="inline-flex min-h-[44px] items-center rounded-full bg-[#F4B400] px-3 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
    >
      {busy ? "Adding…" : "Add to dial"}
      {atVisibleCap ? (
        <span className="sr-only">
          The dial holds 10. This station will be hidden until you free a slot.
        </span>
      ) : null}
    </button>
  );
}
