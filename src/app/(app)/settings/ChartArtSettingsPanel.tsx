"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import {
  chartArtSlots,
  type ChartArtMap,
} from "@/lib/radio/chart-art";
import { notifyRadioStationsChanged, type RadioStation } from "@/lib/radio/types";
import { prepareChartArtUpload } from "@/lib/images/prepare-chart-art";

type Props = {
  stations: RadioStation[];
  initialChartArt: ChartArtMap;
};

export function ChartArtSettingsPanel({ stations, initialChartArt }: Props) {
  const [art, setArt] = useState<ChartArtMap>(initialChartArt);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slots = chartArtSlots(stations);

  const onUploaded = (next: ChartArtMap) => {
    setArt(next);
    notifyRadioStationsChanged();
  };

  return (
    <div className="mt-5 rounded-[16px] border border-stone-100 bg-[#FAF8F3] px-4 py-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Chart Art
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Pictorial maps for the chart panel. One image per state on the dial,
        plus California weather and the baseball diamond. PNG uploads keep
        transparency and are stored as PNG. Leave a slot empty to keep the
        drawn outline.
      </p>
      {error ? (
        <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {slots.map((slot) => (
          <ChartArtSlotRow
            key={slot.key}
            slotKey={slot.key}
            label={slot.label}
            url={art[slot.key] ?? null}
            busy={busyKey === slot.key}
            onBusy={setBusyKey}
            onError={setError}
            onUploaded={onUploaded}
          />
        ))}
      </ul>
    </div>
  );
}

function ChartArtSlotRow({
  slotKey,
  label,
  url,
  busy,
  onBusy,
  onError,
  onUploaded,
}: {
  slotKey: string;
  label: string;
  url: string | null;
  busy: boolean;
  onBusy: (key: string | null) => void;
  onError: (message: string | null) => void;
  onUploaded: (art: ChartArtMap) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    onError(null);
    onBusy(slotKey);
    try {
      const prepared = await prepareChartArtUpload(file);
      const form = new FormData();
      form.append("key", slotKey);
      form.append("photo", prepared.blob, `${slotKey}.${prepared.ext}`);
      const response = await fetch("/api/settings/radio-chart-art", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        chart_art?: ChartArtMap;
        error?: string;
      };
      if (!response.ok) {
        onError(body.error ?? "Could not upload chart art.");
        return;
      }
      if (body.chart_art) onUploaded(body.chart_art);
    } catch {
      onError("Could not upload chart art.");
    } finally {
      onBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    onError(null);
    onBusy(slotKey);
    try {
      const response = await fetch("/api/settings/radio-chart-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", key: slotKey }),
      });
      const body = (await response.json()) as {
        chart_art?: ChartArtMap;
        error?: string;
      };
      if (!response.ok) {
        onError(body.error ?? "Could not remove chart art.");
        return;
      }
      if (body.chart_art) onUploaded(body.chart_art);
    } catch {
      onError("Could not remove chart art.");
    } finally {
      onBusy(null);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-[12px] bg-white px-3 py-2.5">
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[8px] bg-stone-100">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            None
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-stone-900">{label}</p>
        <p className="font-[family-name:var(--font-elite)] text-xs text-stone-500">
          {slotKey}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50"
      >
        <Upload className="h-4 w-4" strokeWidth={2.25} />
        {url ? "Replace" : "Upload"}
      </button>
      {url ? (
        <button
          type="button"
          disabled={busy}
          aria-label={`Remove ${label} chart art`}
          onClick={() => void remove()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </button>
      ) : null}
    </li>
  );
}
