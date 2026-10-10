"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { StationTestButton } from "@/components/radio/StationTestButton";
import {
  RADIO_GENRES,
  RANCH_SUGGESTIONS,
  cityLabelFromResult,
  displayTags,
  extrasFromSearchResult,
  RADIO_DIRECTORY_DOWN,
  resultAlreadyOnDial,
  resultPlace,
  suggestionAlreadyOnDial,
  type RadioGenreId,
  type RanchSuggestion,
} from "@/lib/radio/browser";
import type { RadioSearchResult, RadioStation } from "@/lib/radio/types";
import type { TestPlayerStatus } from "@/lib/radio/use-station-test-player";
import {
  firstOpenFmBand,
  timezoneFromStateCode,
  visibleCapForBand,
  type RadioBand,
  type RadioStationType,
} from "@/lib/radio/ranch";
import type { ChartArtMap } from "@/lib/radio/chart-art";
import { StationStateField } from "./StationStateField";

type Props = {
  stations: RadioStation[];
  chartArt: ChartArtMap;
  onAdd: (input: {
    city_label: string;
    station_name: string;
    stream_url: string;
    call_sign?: string;
    frequency?: string;
    band?: RadioBand;
    station_type?: RadioStationType;
    latitude?: number | null;
    longitude?: number | null;
    state_code?: string | null;
    timezone?: string | null;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const SEARCH_DEBOUNCE_MS = 400;

type SuggestionState = {
  status: "idle" | "loading" | "ready" | "offline";
  result: RadioSearchResult | null;
};

type PendingAdd = {
  key: string;
  result: RadioSearchResult;
  city: string;
  state: string;
  band: RadioBand;
};

type Heard = "loading" | "playing" | "failed";

export function FindStationsPanel({ stations, chartArt, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<RadioGenreId | null>(null);
  const [results, setResults] = useState<RadioSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [heard, setHeard] = useState<Record<string, Heard>>({});
  const [bandChoice, setBandChoice] = useState<Record<string, RadioBand>>({});
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
      let body: { results?: RadioSearchResult[]; error?: string } = {};
      try {
        body = (await response.json()) as {
          results?: RadioSearchResult[];
          error?: string;
        };
      } catch {
        throw new Error(RADIO_DIRECTORY_DOWN);
      }
      if (gen !== searchGen.current) return;
      if (!response.ok) {
        throw new Error(
          response.status >= 500
            ? RADIO_DIRECTORY_DOWN
            : body.error || RADIO_DIRECTORY_DOWN,
        );
      }
      setResults(body.results ?? []);
    } catch (err) {
      if (gen !== searchGen.current) return;
      setSearchError(
        err instanceof Error && err.message
          ? err.message
          : RADIO_DIRECTORY_DOWN,
      );
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

  const noteHeard = (key: string, status: TestPlayerStatus) => {
    if (status !== "loading" && status !== "playing" && status !== "failed") {
      return;
    }
    setHeard((prev) => (prev[key] === status ? prev : { ...prev, [key]: status }));
  };

  const bandFor = (key: string) => bandChoice[key] ?? firstOpenFmBand(stations);

  const blocked = (key: string) => heard[key] === "failed" || heard[key] === "loading";

  const beginAdd = (
    key: string,
    result: RadioSearchResult,
    cityFallback?: string,
  ) => {
    if (blocked(key) || resultAlreadyOnDial(result, stations)) return;
    const extras = extrasFromSearchResult(result);
    setPending({
      key,
      result,
      city: cityFallback || cityLabelFromResult(result),
      state: extras.state_code ?? "",
      band: bandFor(key),
    });
  };

  const addFound = async (result: RadioSearchResult) => {
    const key = result.stationuuid;
    if (blocked(key) || resultAlreadyOnDial(result, stations)) return;
    setAddingKey(key);
    const extras = extrasFromSearchResult(result);
    const state_code = extras.state_code;
    await onAdd({
      city_label: cityLabelFromResult(result),
      station_name: result.name.slice(0, 80),
      stream_url: result.streamUrl,
      ...extras,
      band: bandFor(key),
      state_code,
      timezone: timezoneFromStateCode(state_code) ?? extras.timezone,
    });
    setAddingKey(null);
  };

  const confirmAdd = async () => {
    if (!pending || blocked(pending.key)) return;
    if (resultAlreadyOnDial(pending.result, stations)) {
      setPending(null);
      return;
    }
    setAddingKey(pending.key);
    const extras = extrasFromSearchResult(pending.result);
    const state_code = pending.state || extras.state_code;
    await onAdd({
      city_label: pending.city,
      station_name: pending.result.name.slice(0, 80),
      stream_url: pending.result.streamUrl,
      ...extras,
      band: pending.band,
      state_code,
      timezone: timezoneFromStateCode(state_code) ?? extras.timezone,
    });
    setAddingKey(null);
    setPending(null);
  };

  const showingResults =
    query.trim().length >= 2 || genre !== null;

  return (
    <div className="mt-5 space-y-5">
      <div>
        <label
          htmlFor="find-station"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-stone-500"
        >
          Find a station
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400"
            strokeWidth={2}
          />
          <input
            id="find-station"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Name, call sign, or town"
            className="min-h-[52px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] py-3 pr-4 pl-10 text-base text-stone-800 placeholder:text-stone-400 focus:border-[#C9B98F] focus:outline-none focus:ring-2 focus:ring-[#C9B98F]/40"
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
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {results.map((result) => (
            <FoundStation
              key={result.stationuuid}
              result={result}
              stations={stations}
              band={bandFor(result.stationuuid)}
              busy={addingKey === result.stationuuid}
              dead={heard[result.stationuuid] === "failed"}
              probing={heard[result.stationuuid] === "loading"}
              onBand={(band) =>
                setBandChoice((prev) => ({
                  ...prev,
                  [result.stationuuid]: band,
                }))
              }
              onStatus={(status) => noteHeard(result.stationuuid, status)}
              onAdd={() => void addFound(result)}
            />
          ))}
        </ul>
      ) : showingResults && !searching && !searchError ? (
        <p className="text-sm text-stone-500">
          No stations found for{" "}
          {query.trim() ||
            RADIO_GENRES.find((item) => item.id === genre)?.label ||
            "that search"}
          .
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-stone-600"
      >
        Ranch picks
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      {open ? (
        <div className="space-y-6">
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
                      pending?.key === suggestion.id ? (
                        <AddIdentityDraft
                          pending={pending}
                          stations={stations}
                          chartArt={chartArt}
                          busy={addingKey === suggestion.id}
                          onCity={(city) =>
                            setPending((prev) =>
                              prev ? { ...prev, city } : prev,
                            )
                          }
                          onState={(next) =>
                            setPending((prev) =>
                              prev ? { ...prev, state: next } : prev,
                            )
                          }
                          onBand={(band) =>
                            setPending((prev) =>
                              prev ? { ...prev, band } : prev,
                            )
                          }
                          blocked={blocked(suggestion.id)}
                          onCancel={() => setPending(null)}
                          onConfirm={() => void confirmAdd()}
                        />
                      ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StationTestButton
                          testKey={`suggest:${suggestion.id}`}
                          url={state.result.streamUrl}
                          failLabel="won't play here"
                          onStatus={(status) =>
                            noteHeard(suggestion.id, status)
                          }
                        />
                        <AddToDialButton
                          busy={addingKey === suggestion.id}
                          blocked={blocked(suggestion.id)}
                          atVisibleCap={
                            stations.filter(
                              (s) =>
                                s.is_visible && s.band === bandFor(suggestion.id),
                            ).length >= visibleCapForBand(bandFor(suggestion.id))
                          }
                          onClick={() =>
                            beginAdd(
                              suggestion.id,
                              state.result!,
                              suggestion.city,
                            )
                          }
                        />
                      </div>
                      )
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

        </div>
      ) : null}
    </div>
  );
}

function FoundStation({
  result,
  stations,
  band,
  busy,
  dead,
  probing,
  onBand,
  onStatus,
  onAdd,
}: {
  result: RadioSearchResult;
  stations: RadioStation[];
  band: RadioBand;
  busy: boolean;
  dead: boolean;
  probing: boolean;
  onBand: (band: RadioBand) => void;
  onStatus: (status: TestPlayerStatus) => void;
  onAdd: () => void;
}) {
  const onDial = resultAlreadyOnDial(result, stations);
  const place = resultPlace(result);
  const quality = [
    result.bitrate > 0 ? `${result.bitrate} kbps` : "",
    result.codec,
  ]
    .filter(Boolean)
    .join(" · ");
  const full =
    stations.filter((station) => station.is_visible && station.band === band)
      .length >= visibleCapForBand(band);

  return (
    <li className="flex gap-3 rounded-[14px] border border-stone-100 bg-[#FAF8F3] px-3 py-2.5">
      <StationMark src={result.favicon} name={result.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-stone-900">
          {result.name}
        </p>
        <p className="truncate text-xs text-stone-500">
          {[place || "Unknown location", quality].filter(Boolean).join(" · ")}
        </p>
        {displayTags(result).length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {displayTags(result).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-stone-600 ring-1 ring-stone-200"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {onDial ? (
          <p className="mt-2 text-xs font-medium text-stone-500">
            Already on your dial
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StationTestButton
              testKey={`find:${result.stationuuid}`}
              url={result.streamUrl}
              failLabel="won't play here"
              onStatus={onStatus}
            />
            <select
              aria-label={`Band for ${result.name}`}
              value={band}
              onChange={(event) => onBand(event.target.value as RadioBand)}
              className="min-h-[44px] rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800"
            >
              <option value="fm1">FM1</option>
              <option value="fm2">FM2</option>
              <option value="fm3">FM3</option>
              <option value="am">AM</option>
            </select>
            <AddToDialButton
              busy={busy}
              blocked={dead || probing}
              atVisibleCap={full}
              onClick={onAdd}
            />
            {dead ? (
              <span className="text-xs font-semibold text-red-700">
                won't play here
              </span>
            ) : full ? (
              <span className="text-xs text-stone-500">
                That band is full. This one stays hidden until a slot frees.
              </span>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}

function StationMark({ src, name }: { src: string; name: string }) {
  const [hidden, setHidden] = useState(false);
  if (!src || hidden) {
    return (
      <span
        aria-hidden
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-200 text-xs font-semibold text-stone-600"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // Directory favicons are remote and often missing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      className="mt-0.5 h-10 w-10 shrink-0 rounded-lg bg-white object-contain"
      onError={() => setHidden(true)}
    />
  );
}

function AddIdentityDraft({
  pending,
  stations,
  chartArt,
  busy,
  onCity,
  onState,
  onBand,
  blocked = false,
  onCancel,
  onConfirm,
}: {
  pending: PendingAdd;
  stations: RadioStation[];
  chartArt: ChartArtMap;
  busy: boolean;
  onCity: (city: string) => void;
  onState: (code: string) => void;
  onBand: (band: RadioBand) => void;
  blocked?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-2 w-full space-y-2">
      <input
        type="text"
        value={pending.city}
        maxLength={40}
        onChange={(e) => onCity(e.target.value)}
        className="min-h-[44px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
      />
      <StationStateField
        value={pending.state}
        city={pending.city}
        stations={stations}
        chartArt={chartArt}
        className="min-h-[44px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#C9B98F] focus:outline-none focus:ring-2 focus:ring-[#C9B98F]/40"
        onChange={onState}
      />
      <select
        aria-label="Band"
        value={pending.band}
        onChange={(event) => onBand(event.target.value as RadioBand)}
        className="min-h-[44px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-sm text-stone-800"
      >
        <option value="fm1">FM1</option>
        <option value="fm2">FM2</option>
        <option value="fm3">FM3</option>
        <option value="am">AM</option>
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || blocked}
          onClick={onConfirm}
          className="inline-flex min-h-[44px] items-center rounded-full bg-[#F4B400] px-3 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center rounded-full bg-white px-3 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddToDialButton({
  busy,
  blocked,
  atVisibleCap,
  onClick,
}: {
  busy: boolean;
  blocked?: boolean;
  atVisibleCap: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy || blocked}
      onClick={onClick}
      title={
        blocked
          ? "This stream won't play here."
          : atVisibleCap
            ? "This band is full — it will stay hidden until a slot frees."
            : undefined
      }
      className="inline-flex min-h-[44px] items-center rounded-full bg-[#F4B400] px-3 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
    >
      {busy ? "Adding…" : "Add"}
      {atVisibleCap ? (
        <span className="sr-only">
          This band is full. The station will be hidden until you free a slot.
        </span>
      ) : null}
    </button>
  );
}
