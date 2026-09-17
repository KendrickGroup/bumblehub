"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Copy, Trash2, Upload } from "lucide-react";
import {
  CHART_ART_SPORTS,
  chartArtSlots,
  type ChartArtMap,
} from "@/lib/radio/chart-art";
import { notifyRadioStationsChanged, type RadioStation } from "@/lib/radio/types";
import { prepareChartArtUpload } from "@/lib/images/prepare-chart-art";
import { buildChartArtPrompt } from "@/lib/statePrompts";

type Props = {
  stations: RadioStation[];
  initialChartArt: ChartArtMap;
  onArtChange?: (art: ChartArtMap) => void;
};

const COPY_TOAST = "Prompt copied — paste into your image generator";

function useFinePointerDrag() {
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return fine;
}

function isChartArtFile(file: File): boolean {
  if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function takeDroppedImage(files: FileList | null): {
  file?: File;
  toast?: string;
} {
  if (!files || files.length === 0) return {};
  const first = files[0]!;
  const extra = files.length > 1;
  if (!isChartArtFile(first)) {
    return { toast: extra ? "Drop one image file." : "That isn’t an image." };
  }
  if (extra) {
    return { file: first, toast: "Only the first image is used." };
  }
  return { file: first };
}

export function ChartArtSettingsPanel({
  stations,
  initialChartArt,
  onArtChange,
}: Props) {
  const [art, setArt] = useState<ChartArtMap>(initialChartArt);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slots = chartArtSlots(stations);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const onUploaded = (next: ChartArtMap) => {
    setArt(next);
    onArtChange?.(next);
    notifyRadioStationsChanged();
  };

  const onCopied = () => showToast(COPY_TOAST);

  return (
    <div className="mt-5 rounded-[16px] border border-stone-100 bg-[#FAF8F3] px-4 py-4">
      {toast ? (
        <div
          className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-[18px] border border-[#F4B400]/40 bg-[#FBF0D0] px-5 py-3 text-sm font-medium text-stone-900 shadow-md"
          role="status"
        >
          {toast}
        </div>
      ) : null}
      <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Chart Art
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Pictorial maps for the chart panel. One image per state on the dial,
        plus California weather and the baseball diamond. PNG uploads keep
        transparency and are stored as PNG. Leave a slot empty to keep the
        drawn outline. Drag an image onto a tile to set it.
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
            stations={stations}
            busy={busyKey === slot.key}
            onBusy={setBusyKey}
            onError={setError}
            onToast={showToast}
            onUploaded={onUploaded}
            onCopied={onCopied}
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
  stations,
  busy,
  onBusy,
  onError,
  onToast,
  onUploaded,
  onCopied,
}: {
  slotKey: string;
  label: string;
  url: string | null;
  stations: RadioStation[];
  busy: boolean;
  onBusy: (key: string | null) => void;
  onError: (message: string | null) => void;
  onToast: (message: string) => void;
  onUploaded: (art: ChartArtMap) => void;
  onCopied: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const canDragDrop = useFinePointerDrag();
  const prompt =
    !url && slotKey !== CHART_ART_SPORTS
      ? buildChartArtPrompt(slotKey, stations)
      : null;

  const copyPrompt = async () => {
    if (!prompt) return;
    onError(null);
    try {
      await navigator.clipboard.writeText(prompt);
      onCopied();
    } catch {
      onError("Could not copy the art prompt.");
    }
  };

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

  const clearDrag = () => {
    setDragOver(false);
  };

  const onDragEnter = (e: DragEvent<HTMLLIElement>) => {
    if (!canDragDrop || busy) return;
    e.preventDefault();
    setDragOver(true);
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>) => {
    if (!canDragDrop || busy) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: DragEvent<HTMLLIElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    clearDrag();
  };

  const onDrop = (e: DragEvent<HTMLLIElement>) => {
    if (!canDragDrop) return;
    e.preventDefault();
    clearDrag();
    if (busy) return;
    const taken = takeDroppedImage(e.dataTransfer.files);
    if (taken.toast) onToast(taken.toast);
    if (taken.file) void upload(taken.file);
  };

  return (
    <li
      className={`relative flex items-center gap-3 rounded-[12px] bg-white px-3 py-2.5 ${
        dragOver ? "shadow-[inset_0_0_0_2px_#F4B400] ring-0" : ""
      }`}
      onDragEnter={canDragDrop ? onDragEnter : undefined}
      onDragOver={canDragDrop ? onDragOver : undefined}
      onDragLeave={canDragDrop ? onDragLeave : undefined}
      onDrop={canDragDrop ? onDrop : undefined}
    >
      {dragOver ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[12px] bg-[#FBF0D0]/85">
          <p className="px-3 text-center text-sm font-semibold text-stone-900">
            Drop to set {label}
          </p>
        </div>
      ) : null}
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
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {prompt ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void copyPrompt()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" strokeWidth={2.25} />
            Copy art prompt
          </button>
        ) : null}
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
      </div>
    </li>
  );
}
