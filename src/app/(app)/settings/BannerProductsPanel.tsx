"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Trash2, Upload } from "lucide-react";
import { prepareChartArtUpload } from "@/lib/images/prepare-chart-art";
import {
  BANNER_DEFAULT_LINE,
  BANNER_LINE_MAX,
  BANNER_MAX_IMAGES,
} from "@/lib/radio/banner";
import { notifyRadioStationsChanged } from "@/lib/radio/types";

type Props = {
  initialImages: string[];
  initialLines: string[];
};

function isBannerFile(file: File): boolean {
  if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function takeDroppedImages(files: FileList | null): {
  files: File[];
  toast?: string;
} {
  if (!files || files.length === 0) return { files: [] };
  const kept: File[] = [];
  let skipped = false;
  for (const file of Array.from(files)) {
    if (isBannerFile(file)) kept.push(file);
    else skipped = true;
  }
  if (kept.length === 0) {
    return { files: [], toast: "That isn’t an image." };
  }
  return {
    files: kept,
    toast: skipped ? "Skipped files that aren’t images." : undefined,
  };
}

export function BannerProductsPanel({ initialImages, initialLines }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initialImages);
  const [lines, setLines] = useState(initialLines.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (lineTimer.current) clearTimeout(lineTimer.current);
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const onUploaded = (nextImages: string[], nextLines?: string[]) => {
    setImages(nextImages);
    if (nextLines) setLines(nextLines.join("\n"));
    notifyRadioStationsChanged();
  };

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    const room = BANNER_MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(`The banner holds ${BANNER_MAX_IMAGES} images.`);
      return;
    }
    const batch = files.slice(0, room);
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      for (const file of batch) {
        const prepared = await prepareChartArtUpload(file);
        form.append("photos", prepared.blob, `banner.${prepared.ext}`);
      }
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        banner_images?: string[];
        banner_lines?: string[];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not upload banner images.");
        return;
      }
      if (body.banner_images) onUploaded(body.banner_images, body.banner_lines);
      if (files.length > batch.length) {
        showToast(`Added ${batch.length}. The banner holds ${BANNER_MAX_IMAGES}.`);
      }
    } catch {
      setError("Could not upload banner images.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (url: string) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", url }),
      });
      const body = (await response.json()) as {
        banner_images?: string[];
        banner_lines?: string[];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not remove that image.");
        return;
      }
      if (body.banner_images) onUploaded(body.banner_images, body.banner_lines);
    } catch {
      setError("Could not remove that image.");
    } finally {
      setBusy(false);
    }
  };

  const saveLines = async (value: string) => {
    setError(null);
    try {
      const response = await fetch("/api/settings/radio-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lines", lines: value }),
      });
      const body = (await response.json()) as {
        banner_images?: string[];
        banner_lines?: string[];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not save banner lines.");
        return;
      }
      if (body.banner_lines) {
        setLines(body.banner_lines.join("\n"));
        notifyRadioStationsChanged();
      }
    } catch {
      setError("Could not save banner lines.");
    }
  };

  const onLinesChange = (value: string) => {
    setLines(value);
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => {
      void saveLines(value);
    }, 600);
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (busy) return;
    e.preventDefault();
    setDragOver(true);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (busy) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const taken = takeDroppedImages(e.dataTransfer.files);
    if (taken.toast) showToast(taken.toast);
    if (taken.files.length) void upload(taken.files);
  };

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
        Banner Products
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Images rotate every few seconds and shuffle position — square shots work
        best. Banner lines rotate with them.
      </p>
      {error ? (
        <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
      ) : null}

      <div
        className={`relative mt-4 rounded-[12px] border border-dashed px-4 py-6 text-center ${
          dragOver
            ? "border-[#F4B400] bg-[#FBF0D0]/80"
            : "border-stone-300 bg-white"
        }`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const taken = takeDroppedImages(e.target.files);
            if (taken.toast) showToast(taken.toast);
            if (taken.files.length) void upload(taken.files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto h-6 w-6 text-stone-400" aria-hidden />
        <p className="mt-2 text-sm text-stone-700">
          Drop several product shots, or{" "}
          <button
            type="button"
            className="font-semibold text-stone-900 underline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
          .
        </p>
      </div>

      {images.length > 0 ? (
        <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((url) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="aspect-square w-full rounded-[8px] object-cover shadow-[0_1px_3px_rgba(0,0,0,.25)]"
              />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-stone-700 shadow"
                disabled={busy}
                aria-label="Remove image"
                onClick={() => void remove(url)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-stone-500">
          No shots yet — the strap shows a silver concho until you add some.
        </p>
      )}

      <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-stone-500">
        Banner lines
        <textarea
          value={lines}
          onChange={(e) => onLinesChange(e.target.value)}
          onBlur={() => void saveLines(lines)}
          rows={8}
          maxLength={BANNER_LINE_MAX * 40}
          className="mt-2 w-full rounded-[12px] border border-stone-200 bg-white px-3 py-2 font-[family-name:var(--font-elite)] text-sm text-stone-800"
          placeholder={BANNER_DEFAULT_LINE}
        />
      </label>
      <p className="mt-1 text-xs text-stone-500">
        One line per row. Empty rows are dropped. Each rotation picks a random
        line (about {BANNER_LINE_MAX} characters).
      </p>
    </div>
  );
}
