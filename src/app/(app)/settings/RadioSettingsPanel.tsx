"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { StationTestButton } from "@/components/radio/StationTestButton";
import { stopStationTest } from "@/lib/radio/use-station-test-player";
import {
  MAX_VISIBLE_STATIONS,
  notifyRadioStationsChanged,
  type RadioSearchResult,
  type RadioStation,
} from "@/lib/radio/types";
import {
  createRadioStation,
  deleteRadioStation,
  reorderRadioStations,
  updateRadioStation,
} from "./radio-actions";

type Props = {
  hasProperty: boolean;
  initialStations: RadioStation[];
};

const TEXT_DEBOUNCE_MS = 600;
const SEARCH_DEBOUNCE_MS = 400;

export function RadioSettingsPanel({ hasProperty, initialStations }: Props) {
  const [stations, setStations] = useState(initialStations);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    return () => stopStationTest();
  }, []);

  const visibleCount = stations.filter((s) => s.is_visible).length;
  const atVisibleCap = visibleCount >= MAX_VISIBLE_STATIONS;

  const applyStation = useCallback((station: RadioStation) => {
    setStations((prev) => prev.map((s) => (s.id === station.id ? station : s)));
    notifyRadioStationsChanged();
  }, []);

  const moveStation = useCallback(async (id: string, direction: -1 | 1) => {
    setError(null);
    let orderedIds: string[] = [];
    setStations((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= prev.length) return prev;
      const reordered = [...prev];
      const [item] = reordered.splice(index, 1);
      reordered.splice(next, 0, item!);
      orderedIds = reordered.map((s) => s.id);
      return reordered;
    });
    if (orderedIds.length === 0) return;
    const result = await reorderRadioStations(orderedIds);
    if (result.ok && "stations" in result && result.stations) {
      setStations(result.stations);
      notifyRadioStationsChanged();
    } else if (!result.ok) {
      setError(result.error);
    }
  }, []);

  const toggleVisible = useCallback(
    async (station: RadioStation) => {
      setError(null);
      if (!station.is_visible && atVisibleCap) {
        setError("The dial holds 10 — hide one to add another.");
        return;
      }
      const nextVisible = !station.is_visible;
      setStations((prev) =>
        prev.map((s) =>
          s.id === station.id ? { ...s, is_visible: nextVisible } : s,
        ),
      );
      const result = await updateRadioStation({
        id: station.id,
        is_visible: nextVisible,
      });
      if (result.ok && "station" in result && result.station) {
        applyStation(result.station);
      } else if (!result.ok) {
        setStations((prev) =>
          prev.map((s) =>
            s.id === station.id ? { ...s, is_visible: station.is_visible } : s,
          ),
        );
        setError(result.error);
      }
    },
    [applyStation, atVisibleCap],
  );

  const commitFields = useCallback(
    async (
      id: string,
      fields: { city_label: string; station_name: string; stream_url: string },
    ) => {
      setError(null);
      const result = await updateRadioStation({ id, ...fields });
      if (result.ok && "station" in result && result.station) {
        applyStation(result.station);
      } else if (!result.ok) {
        setError(result.error);
      }
    },
    [applyStation],
  );

  const removeStation = useCallback(async (id: string) => {
    if (!window.confirm("Delete this station from the dial?")) return;
    setError(null);
    const result = await deleteRadioStation(id);
    if (result.ok) {
      setStations((prev) => prev.filter((s) => s.id !== id));
      notifyRadioStationsChanged();
    } else {
      setError(result.error);
    }
  }, []);

  const addStation = useCallback(
    async (input: {
      city_label: string;
      station_name: string;
      stream_url: string;
    }) => {
      setError(null);
      const result = await createRadioStation({
        ...input,
        is_visible: !atVisibleCap,
      });
      if (result.ok && "station" in result && result.station) {
        setStations((prev) => [...prev, result.station]);
        notifyRadioStationsChanged();
        return { ok: true as const };
      }
      if (!result.ok) {
        setError(result.error);
        return { ok: false as const, error: result.error };
      }
      return { ok: false as const, error: "Could not add station." };
    },
    [atVisibleCap],
  );

  if (!hasProperty) {
    return (
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Set a default home to manage radio stations.
      </div>
    );
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Radio
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Stations on the house dial, west to east. Guests can tune; only this
        screen edits the list.
      </p>

      {atVisibleCap ? (
        <p className="mt-4 rounded-[14px] bg-[#FBF0D0] px-4 py-3 text-sm font-medium text-stone-800">
          The dial holds 10 — hide one to add another.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
      ) : null}

      <div className="mt-5 space-y-3">
        {stations.map((station, index) => (
          <StationRow
            key={station.id}
            station={station}
            isFirst={index === 0}
            isLast={index === stations.length - 1}
            editing={editingId === station.id}
            canShow={!station.is_visible && !atVisibleCap}
            onToggleEdit={() =>
              setEditingId((id) => (id === station.id ? null : station.id))
            }
            onMove={moveStation}
            onToggleVisible={toggleVisible}
            onCommitFields={commitFields}
            onDelete={removeStation}
          />
        ))}
        {stations.length === 0 ? (
          <p className="rounded-[16px] bg-[#FAF8F3] px-4 py-6 text-center text-sm text-stone-500">
            No stations yet. Add one below.
          </p>
        ) : null}
      </div>

      <AddStationPanel atVisibleCap={atVisibleCap} onAdd={addStation} />
    </section>
  );
}

type StationRowProps = {
  station: RadioStation;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  canShow: boolean;
  onToggleEdit: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggleVisible: (station: RadioStation) => void;
  onCommitFields: (
    id: string,
    fields: { city_label: string; station_name: string; stream_url: string },
  ) => void;
  onDelete: (id: string) => void;
};

const StationRow = memo(function StationRow({
  station,
  isFirst,
  isLast,
  editing,
  canShow,
  onToggleEdit,
  onMove,
  onToggleVisible,
  onCommitFields,
  onDelete,
}: StationRowProps) {
  return (
    <div
      className={`rounded-[16px] border px-3 py-3 sm:px-4 ${
        station.is_visible
          ? "border-stone-100 bg-[#FAF8F3]"
          : "border-stone-100 bg-stone-50 opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton
            label="Move up"
            disabled={isFirst}
            onClick={() => onMove(station.id, -1)}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          </IconButton>
          <IconButton
            label="Move down"
            disabled={isLast}
            onClick={() => onMove(station.id, 1)}
          >
            <ArrowDown className="h-4 w-4" strokeWidth={2.25} />
          </IconButton>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-500">
            {station.city_label}
          </p>
          <p className="truncate text-base font-semibold text-stone-900">
            {station.station_name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StationTestButton
            testKey={`row:${station.id}`}
            url={station.stream_url}
            compact
          />
          <IconButton
            label={station.is_visible ? "Hide from dial" : "Show on dial"}
            disabled={!station.is_visible && !canShow}
            onClick={() => onToggleVisible(station)}
          >
            {station.is_visible ? (
              <Eye className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <EyeOff className="h-4 w-4" strokeWidth={2.25} />
            )}
          </IconButton>
          <IconButton
            label={editing ? "Done editing" : "Edit"}
            onClick={onToggleEdit}
            active={editing}
          >
            {editing ? (
              <X className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Pencil className="h-4 w-4" strokeWidth={2.25} />
            )}
          </IconButton>
          <IconButton
            label="Delete"
            danger
            onClick={() => onDelete(station.id)}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          </IconButton>
        </div>
      </div>

      {editing ? (
        <StationEditFields
          key={station.id}
          stationId={station.id}
          initialCity={station.city_label}
          initialName={station.station_name}
          initialUrl={station.stream_url}
          onCommit={onCommitFields}
        />
      ) : null}
    </div>
  );
});

function IconButton({
  label,
  children,
  onClick,
  disabled,
  danger,
  active,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-35 ${
        danger
          ? "bg-red-50 text-red-700 hover:bg-red-100"
          : active
            ? "bg-stone-900 text-white"
            : "bg-white text-stone-600 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

const StationEditFields = memo(function StationEditFields({
  stationId,
  initialCity,
  initialName,
  initialUrl,
  onCommit,
}: {
  stationId: string;
  initialCity: string;
  initialName: string;
  initialUrl: string;
  onCommit: (
    id: string,
    fields: { city_label: string; station_name: string; stream_url: string },
  ) => void;
}) {
  const [city, setCity] = useState(initialCity);
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const latestRef = useRef({ city: initialCity, name: initialName, url: initialUrl });
  const committedRef = useRef({
    city: initialCity,
    name: initialName,
    url: initialUrl,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestRef.current = { city, name, url };
  }, [city, name, url]);

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const next = latestRef.current;
    if (
      next.city === committedRef.current.city &&
      next.name === committedRef.current.name &&
      next.url === committedRef.current.url
    ) {
      return;
    }
    committedRef.current = next;
    onCommit(stationId, {
      city_label: next.city,
      station_name: next.name,
      stream_url: next.url,
    });
  }, [onCommit, stationId]);

  const schedule = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, TEXT_DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const next = latestRef.current;
      if (
        next.city !== committedRef.current.city ||
        next.name !== committedRef.current.name ||
        next.url !== committedRef.current.url
      ) {
        committedRef.current = next;
        onCommit(stationId, {
          city_label: next.city,
          station_name: next.name,
          stream_url: next.url,
        });
      }
    };
  }, [onCommit, stationId]);

  const onField =
    (setter: (value: string) => void) =>
    (e: FormEvent<HTMLInputElement>) => {
      setter(e.currentTarget.value);
      schedule();
    };

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="block sm:col-span-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
          City label
        </span>
        <input
          type="text"
          value={city}
          maxLength={40}
          onChange={onField(setCity)}
          onBlur={flush}
          className="min-h-[48px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
        />
      </label>
      <label className="block sm:col-span-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
          Station name
        </span>
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={onField(setName)}
          onBlur={flush}
          className="min-h-[48px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
          Stream URL
        </span>
        <input
          type="url"
          value={url}
          maxLength={500}
          onChange={onField(setUrl)}
          onBlur={flush}
          className="min-h-[48px] w-full rounded-[12px] border border-stone-200 bg-white px-3 font-mono text-xs text-stone-800 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
        />
      </label>
    </div>
  );
});

function AddStationPanel({
  atVisibleCap,
  onAdd,
}: {
  atVisibleCap: boolean;
  onAdd: (input: {
    city_label: string;
    station_name: string;
    stream_url: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RadioSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGen = useRef(0);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    const q = value.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) {
      searchGen.current += 1;
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const gen = ++searchGen.current;
    searchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/radio/search?q=${encodeURIComponent(q)}`,
            { cache: "no-store" },
          );
          const body = (await response.json()) as {
            results?: RadioSearchResult[];
            error?: string;
          };
          if (gen !== searchGen.current) return;
          if (!response.ok) {
            throw new Error(body.error ?? "Search failed");
          }
          setResults(body.results ?? []);
          setSearchError(null);
        } catch (err) {
          if (gen !== searchGen.current) return;
          setSearchError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
        } finally {
          if (gen === searchGen.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
  };

  const fillFromResult = (result: RadioSearchResult) => {
    setName(result.name);
    setUrl(result.streamUrl);
    setCity(result.state || result.country || "");
  };

  const save = async () => {
    setSaving(true);
    const result = await onAdd({
      city_label: city,
      station_name: name,
      stream_url: url,
    });
    setSaving(false);
    if (result.ok) {
      setCity("");
      setName("");
      setUrl("");
      setQuery("");
      setResults([]);
    }
  };

  return (
    <div className="mt-8 border-t border-stone-100 pt-8">
      <h3 className="text-base font-semibold text-stone-900">Add a station</h3>
      <p className="mt-1 text-sm text-stone-600">
        Search the Radio Browser catalog or paste a stream URL.
      </p>

      <div className="mt-5">
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
        {searching ? (
          <p className="mt-2 text-sm text-stone-500">Searching…</p>
        ) : null}
        {searchError ? (
          <p className="mt-2 text-sm font-medium text-red-700">{searchError}</p>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {results.map((result) => {
              const place = [result.state, result.country]
                .filter(Boolean)
                .join(", ");
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
                  </div>
                  <StationTestButton
                    testKey={`search:${result.stationuuid}`}
                    url={result.streamUrl}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => fillFromResult(result)}
                    className="inline-flex min-h-[44px] items-center rounded-full bg-white px-3 text-sm font-semibold text-stone-800 ring-1 ring-stone-200 transition hover:bg-stone-50"
                  >
                    Add to dial
                  </button>
                </li>
              );
            })}
          </ul>
        ) : query.trim().length >= 2 && !searching && !searchError ? (
          <p className="mt-2 text-sm text-stone-500">
            No https streams found for that name.
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
          Manual
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={city}
            maxLength={40}
            placeholder="City label"
            onChange={(e) => setCity(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-base text-stone-800 placeholder:text-stone-400 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
          />
          <input
            type="text"
            value={name}
            maxLength={80}
            placeholder="Station name"
            onChange={(e) => setName(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-base text-stone-800 placeholder:text-stone-400 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
          />
          <input
            type="url"
            value={url}
            maxLength={500}
            placeholder="https://stream…"
            onChange={(e) => setUrl(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 font-mono text-sm text-stone-800 placeholder:text-stone-400 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 sm:col-span-2"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StationTestButton testKey="manual" url={url} />
          <button
            type="button"
            disabled={saving || !city.trim() || !name.trim() || !url.trim()}
            onClick={() => void save()}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-[14px] bg-[#F4B400] px-5 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Save station
          </button>
        </div>
        {atVisibleCap ? (
          <p className="mt-2 text-xs text-stone-500">
            Saved stations stay hidden until you free a slot on the dial.
          </p>
        ) : null}
      </div>
    </div>
  );
}
