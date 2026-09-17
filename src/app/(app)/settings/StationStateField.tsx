"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import type { ChartArtMap } from "@/lib/radio/chart-art";
import { US_STATE_NAMES } from "@/lib/radio/ranch";
import type { RadioStation } from "@/lib/radio/types";
import { buildChartArtPrompt } from "@/lib/statePrompts";

type Props = {
  value: string;
  city?: string;
  stations: RadioStation[];
  chartArt: ChartArtMap;
  className: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
};

type Mark = {
  code: string;
  name: string;
  hasArt: boolean;
  stationCount: number;
  optionLabel: string;
};

function marksFor(
  stations: RadioStation[],
  chartArt: ChartArtMap,
): Mark[] {
  const counts = new Map<string, number>();
  for (const station of stations) {
    const code = station.state_code?.trim().toUpperCase() ?? "";
    if (!US_STATE_NAMES[code]) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return Object.entries(US_STATE_NAMES)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => {
      const hasArt = Boolean(chartArt[code]);
      const stationCount = counts.get(code) ?? 0;
      let optionLabel = name;
      if (hasArt) optionLabel += " ✓";
      if (stationCount > 0) {
        optionLabel += ` · ${stationCount} station${
          stationCount === 1 ? "" : "s"
        }`;
      }
      return { code, name, hasArt, stationCount, optionLabel };
    });
}

export function StationStateField({
  value,
  city,
  stations,
  chartArt,
  className,
  onChange,
  onBlur,
}: Props) {
  const code = value.trim().toUpperCase();
  const marks = marksFor(stations, chartArt);
  const selected = marks.find((mark) => mark.code === code) ?? null;
  const known = Boolean(US_STATE_NAMES[code]);
  const missingArt = Boolean(selected && !selected.hasArt);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const copyPrompt = async () => {
    if (!selected) return;
    const prompt = buildChartArtPrompt(selected.code, stations, city);
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <select
        value={known ? code : value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={className}
      >
        <option value="">State</option>
        {!known && value ? <option value={value}>{value}</option> : null}
        {marks.map((mark) => (
          <option key={mark.code} value={mark.code}>
            {mark.optionLabel}
          </option>
        ))}
      </select>
      {missingArt && selected ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span>No map art for {selected.name} yet</span>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-white px-2.5 text-xs font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
            {copied ? "Copied" : "Copy art prompt"}
          </button>
        </p>
      ) : null}
    </div>
  );
}
