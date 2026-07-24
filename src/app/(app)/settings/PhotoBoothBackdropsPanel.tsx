"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import type { BoothBackdrop } from "@/lib/guestbook/backdrops";
import { downscaleImageFile } from "@/lib/images/downscale";

type Props = {
  hasProperty: boolean;
  initialBackdrops: BoothBackdrop[];
};

const NAME_DEBOUNCE_MS = 600;

const BackdropNameField = memo(function BackdropNameField({
  backdropId,
  initialName,
  disabled,
  onCommit,
}: {
  backdropId: string;
  initialName: string;
  disabled: boolean;
  onCommit: (id: string, name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const latestRef = useRef(initialName);
  const committedRef = useRef(initialName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestRef.current = name;
  }, [name]);

  useEffect(() => {
    setName(initialName);
    latestRef.current = initialName;
    committedRef.current = initialName;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on id change
  }, [backdropId]);

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const next = latestRef.current.trim().slice(0, 40);
    if (next === committedRef.current) return;
    committedRef.current = next;
    onCommit(backdropId, next);
  }, [backdropId, onCommit]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const next = latestRef.current.trim().slice(0, 40);
      if (next !== committedRef.current) {
        committedRef.current = next;
        onCommit(backdropId, next);
      }
    };
  }, [backdropId, onCommit]);

  return (
    <input
      type="text"
      value={name}
      disabled={disabled}
      maxLength={40}
      placeholder="Name this backdrop"
      onChange={(e) => {
        setName(e.target.value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(flush, NAME_DEBOUNCE_MS);
      }}
      onBlur={flush}
      className="min-h-[40px] w-full rounded-[10px] border border-stone-200 bg-white px-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-50"
    />
  );
});

export function PhotoBoothBackdropsPanel({
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

      const response = await fetch("/api/settings/guestbook-backdrops", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        error?: string;
        backdrops?: BoothBackdrop[];
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

  const rename = useCallback(async (id: string, name: string) => {
    setBackdrops((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name } : b)),
    );
    try {
      const response = await fetch("/api/settings/guestbook-backdrops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", id, name }),
      });
      const body = (await response.json()) as {
        error?: string;
        backdrops?: BoothBackdrop[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not rename");
      }
      if (body.backdrops) setBackdrops(body.backdrops);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    }
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm("Remove this backdrop?")) return;
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
        backdrops?: BoothBackdrop[];
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
    <div>
      <h3 className="text-base font-semibold text-stone-900">Backdrops</h3>
      <p className="mt-1 text-sm text-stone-600">
        Custom backgrounds for the Photo Booth. Up to 6. Name them so guests
        can pick by look — not by filename.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {backdrops.map((bd) => (
          <div
            key={bd.id}
            className="overflow-hidden rounded-[16px] border border-stone-100 bg-[#FAF8F3] p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bd.url}
              alt={bd.name || "Backdrop"}
              className="aspect-[3/4] w-full rounded-[12px] object-cover"
            />
            <div className="mt-2 space-y-2">
              <BackdropNameField
                backdropId={bd.id}
                initialName={bd.name}
                disabled={busy}
                onCommit={rename}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(bd.id)}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[12px] bg-red-50 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Remove
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
    </div>
  );
}
