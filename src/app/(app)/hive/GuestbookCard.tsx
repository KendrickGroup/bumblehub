"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import type { GuestbookPhoto } from "@/lib/photos";
import { formatRelativeDate } from "@/lib/hive/format";
import { deleteGuestbookPhoto } from "./actions";

type Props = {
  photo: GuestbookPhoto;
  canDelete: boolean;
  onDeleted?: (id: string) => void;
};

export function GuestbookCard({ photo, canDelete, onDeleted }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const when = formatRelativeDate(photo.taken_at ?? photo.created_at);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    if (!canDelete) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
      setConfirming(false);
    }, 550);
  };

  const removePhoto = () => {
    startTransition(async () => {
      setError(null);
      const result = await deleteGuestbookPhoto(photo.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMenuOpen(false);
      setConfirming(false);
      onDeleted?.(photo.id);
      router.refresh();
    });
  };

  return (
    <article
      className="relative overflow-hidden rounded-[20px] bg-white shadow-sm"
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      onContextMenu={(e) => {
        if (!canDelete) return;
        e.preventDefault();
        setMenuOpen(true);
        setConfirming(false);
      }}
    >
      <div className="relative aspect-[4/3] w-full bg-[#FBF0D0]">
        <Image
          src={photo.displayUrl}
          alt={photo.caption ?? "Guestbook photo"}
          fill
          className="rounded-t-[16px] object-cover"
          sizes="(max-width: 640px) 100vw, 320px"
          unoptimized
        />
        {canDelete && (
          <button
            type="button"
            aria-label="Photo options"
            onClick={() => {
              setMenuOpen((open) => !open);
              setConfirming(false);
            }}
            className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-stone-900/45 text-white backdrop-blur-sm transition hover:bg-stone-900/65"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="space-y-1 px-4 py-3">
        {photo.caption ? (
          <p className="text-[15px] font-medium text-stone-900">{photo.caption}</p>
        ) : (
          <p className="text-[15px] text-stone-400">No caption</p>
        )}
        {when && <p className="text-sm text-stone-500">{when}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {menuOpen && canDelete && (
        <div className="absolute inset-x-3 top-14 z-10 rounded-[16px] border border-stone-200 bg-white p-3 shadow-lg">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-[48px] w-full rounded-[12px] px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Remove from guestbook
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-stone-700">
                Remove this photo? This can&apos;t be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setConfirming(false);
                    setMenuOpen(false);
                  }}
                  className="min-h-[44px] rounded-[12px] border border-stone-200 text-sm font-medium text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={removePhoto}
                  className="min-h-[44px] rounded-[12px] bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
