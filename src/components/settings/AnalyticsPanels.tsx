"use client";

/**
 * The two ranked lists, in the ordinary Settings row treatment — no chart.
 *
 * Stations rank by time listened, not play count: a station people tap and
 * abandon is not popular. Products rank by expand rate, so a shirt that rarely
 * shows but always gets a look rises instead of hiding behind whatever shows
 * most.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_DEFAULT,
  formatAverage,
  formatListenTime,
  formatRate,
  rangeLabel,
  type AnalyticsRange,
  type ProductTotal,
  type StationTotal,
} from "@/lib/radio/analytics";
import { SettingsGroup, SettingsRow } from "./SettingsRows";

type Body = {
  stations?: StationTotal[];
  products?: ProductTotal[];
  error?: string;
};

type Feed = {
  stations: StationTotal[];
  products: ProductTotal[];
  error: string | null;
  /** Which range/owner pair these numbers answer, so a flip reads as loading. */
  key: string | null;
};

const EMPTY: Feed = {
  stations: [],
  products: [],
  error: null,
  key: null,
};

function useAnalytics(
  range: AnalyticsRange,
  includeOwner: boolean,
): Feed & { loading: boolean } {
  const [feed, setFeed] = useState<Feed>(EMPTY);
  const key = `${range}:${includeOwner ? "1" : "0"}`;

  const load = useCallback(async (): Promise<Feed> => {
    try {
      const response = await fetch(
        `/api/settings/radio-analytics?range=${range}&owner=${includeOwner ? "1" : "0"}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as Body;
      if (!response.ok) {
        return {
          ...EMPTY,
          error: body.error ?? "Could not read the numbers.",
          key,
        };
      }
      return {
        stations: body.stations ?? [],
        products: body.products ?? [],
        error: null,
        key,
      };
    } catch {
      return { ...EMPTY, error: "Could not read the numbers.", key };
    }
  }, [range, includeOwner, key]);

  useEffect(() => {
    let alive = true;
    void load().then((next) => {
      if (alive) setFeed(next);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  return { ...feed, loading: feed.key !== key };
}

function Toggles({
  range,
  includeOwner,
  onRange,
  onIncludeOwner,
  ownerLabel,
}: {
  range: AnalyticsRange;
  includeOwner: boolean;
  onRange: (next: AnalyticsRange) => void;
  onIncludeOwner: (next: boolean) => void;
  ownerLabel: string;
}) {
  return (
    <>
      <SettingsRow title="Range">
        <span className="flex gap-1.5">
          {ANALYTICS_RANGES.map((option) => {
            const active = option === range;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => onRange(option)}
                className={`min-h-[34px] rounded-full px-3 text-[12.5px] font-semibold ${
                  active
                    ? "bg-[#F4B400] text-[#3E2F20]"
                    : "border border-[#e3d9c6] bg-white text-stone-600"
                }`}
              >
                {rangeLabel(option)}
              </button>
            );
          })}
        </span>
      </SettingsRow>
      <SettingsRow title={ownerLabel} hint="Off by default, so the wall iPad doesn't drown out the guests">
        <input
          type="checkbox"
          checked={includeOwner}
          onChange={(event) => onIncludeOwner(event.target.checked)}
          className="h-[22px] w-[22px] accent-[#F4B400]"
          aria-label={ownerLabel}
        />
      </SettingsRow>
    </>
  );
}

function StatusRow({ loading, error, empty }: {
  loading: boolean;
  error: string | null;
  empty: string;
}) {
  if (loading) return <p className="settings-hint">Reading the log…</p>;
  if (error) return <p className="settings-hint settings-hint-error">{error}</p>;
  return <p className="settings-hint">{empty}</p>;
}

/** Numbers from the range Dave just left, faded until the new ones land. */
function Rows({ loading, children }: { loading: boolean; children: ReactNode }) {
  return <div style={loading ? { opacity: 0.5 } : undefined}>{children}</div>;
}

export function StationPlaysPanel() {
  const [range, setRange] = useState<AnalyticsRange>(ANALYTICS_RANGE_DEFAULT);
  const [includeOwner, setIncludeOwner] = useState(false);
  const { stations, loading, error } = useAnalytics(range, includeOwner);

  return (
    <SettingsGroup
      title="WHAT GETS PLAYED"
      hint="A tune counts after ten seconds, so spinning the presets leaves nothing behind. Ranked by time listened."
    >
      <Toggles
        range={range}
        includeOwner={includeOwner}
        onRange={setRange}
        onIncludeOwner={setIncludeOwner}
        ownerLabel="Include my own listening"
      />
      {stations.length === 0 ? (
        <StatusRow
          loading={loading}
          error={error}
          empty="Nothing logged in this range yet."
        />
      ) : (
        <Rows loading={loading}>
          {stations.map((station) => {
            const dial = [station.stationCall, station.frequency]
              .filter(Boolean)
              .join(" ");
            const average =
              station.plays > 0 ? station.seconds / station.plays : 0;
            return (
              <SettingsRow
                key={`${station.stationCall}:${station.stationId ?? ""}`}
                title={dial || station.stationCall}
                hint={`${station.plays} ${station.plays === 1 ? "play" : "plays"} · avg ${formatAverage(average)}`}
                value={formatListenTime(station.seconds)}
              />
            );
          })}
        </Rows>
      )}
    </SettingsGroup>
  );
}

export function BannerPerformancePanel() {
  const [range, setRange] = useState<AnalyticsRange>(ANALYTICS_RANGE_DEFAULT);
  const [includeOwner, setIncludeOwner] = useState(false);
  const { products, loading, error } = useAnalytics(range, includeOwner);

  return (
    <SettingsGroup
      title="WHAT THE BANNER DOES"
      hint="An expand is curiosity, a buy is intent. Many expands and no buys is the design talking. Ranked by expand rate."
    >
      <Toggles
        range={range}
        includeOwner={includeOwner}
        onRange={setRange}
        onIncludeOwner={setIncludeOwner}
        ownerLabel="Include my own taps"
      />
      {products.length === 0 ? (
        <StatusRow
          loading={loading}
          error={error}
          empty="Nothing logged in this range yet."
        />
      ) : (
        <Rows loading={loading}>
          {products.map((product) => (
            <SettingsRow
              key={product.handle}
              title={product.title}
              hint={`${product.impressions} shown · ${product.expands} ${
                product.expands === 1 ? "expand" : "expands"
              } · ${product.buys} ${
                product.buys === 1 ? "buy" : "buys"
              } (${formatRate(product.buys, product.expands)} of expands)`}
            >
              <span className="flex items-center gap-2">
                {product.retired ? (
                  <span className="settings-badge">Retired</span>
                ) : null}
                <span className="settings-value">
                  {formatRate(product.expands, product.impressions)}
                </span>
              </span>
            </SettingsRow>
          ))}
        </Rows>
      )}
    </SettingsGroup>
  );
}
