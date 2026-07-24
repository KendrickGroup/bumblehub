"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import type { CustomBackdrop } from "@/lib/guestbook/backdrops";
import { downscaleImageFile } from "@/lib/images/downscale";

type Props = {
  hasProperty: boolean;
  initialBackdrops: CustomBackdrop[];
};

export function GuestbookBackdropsPanel({
  hasProperty,
  initialBackdrops,
}: Props) {
  const [backdrops, setBackdrops] = useState(initialBackdrops);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBackdrops(initialBackdrops);
  }, [initialBackdrops]);

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const blob = await downscaleImageFile(file, 1920, 0.85);
      const form = new FormData();
      form.append(
        "photo",
        new File([blob], "backdrop.jpg", { type: "image/jpeg" }),
      );
      form.append("label", file.name.replace(/\.[^.]+$/, "").slice(0, 40));

      const response = await fetch("/api/settings/guestbook-backdrops", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        error?: string;
        backdrops?: CustomBackdrop[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Upload failed");
      }
      if (body.backdrops) setBackdrops(body.backdrops);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm("Remove this custom backdrop?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/guestbook-backdrops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      const body = (await response.json()) as {
        error?: string;
        backdrops?: CustomBackdrop[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove");
      }
      if (body.backdrops) setBackdrops(body.backdrops);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  };

  if (!hasProperty) return null;

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Guestbook backdrops
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Custom photo-booth backgrounds for guestbook captures. Up to 6 images.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {backdrops.map((bd) => (
          <div
            key={bd.id}
            className="relative overflow-hidden rounded-[16px] bg-stone-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bd.url}
              alt={bd.label}
              className="aspect-[3/4] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-2 py-2">
              <span className="truncate text-xs font-medium text-white">
                {bd.label}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(bd.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-800 disabled:opacity-50"
                aria-label={`Remove ${bd.label}`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}

        {backdrops.length < 6 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-stone-300 bg-[#FAF8F3] text-stone-600 transition hover:border-[#F4B400] hover:bg-[#F4B400]/10 disabled:opacity-50"
          >
            <Upload className="h-6 w-6 text-[#E0972B]" strokeWidth={1.75} />
            <span className="text-sm font-semibold">
              {busy ? "Uploading…" : "Upload"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-3 text-sm text-amber-800">{error}</p>}
    </section>
  );
}
