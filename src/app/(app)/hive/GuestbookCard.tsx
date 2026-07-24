"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import type { GuestbookPhoto } from "@/lib/photos";
import {
  fromDateInputValue,
  guestbookTakenDateLabel,
  toDateInputValue,
} from "@/lib/hive/photo-labels";
import { deleteGuestbookPhoto, updateGuestbookPhoto } from "./actions";

type Props = {
  photo: GuestbookPhoto;
  canDelete: boolean;
  onDeleted?: (id: string) => void;
  onUpdated?: (photo: GuestbookPhoto) => void;
};

export function GuestbookCard({
  photo,
  canDelete,
  onDeleted,
  onUpdated,
}: Props) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [dateValue, setDateValue] = useState(toDateInputValue(photo.taken_at));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setCaption(photo.caption ?? "");
    setDateValue(toDateInputValue(photo.taken_at));
    setConfirmRemove(false);
    setError(null);
  }, [open, photo.caption, photo.taken_at]);

  const dateLabel = guestbookTakenDateLabel(photo.taken_at, "relative");

  const saveEdits = () => {
    startTransition(async () => {
      setError(null);
      const result = await updateGuestbookPhoto({
        photoId: photo.id,
        caption,
        taken_at: fromDateInputValue(dateValue),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated?.({
        ...photo,
        caption: result.photo.caption,
        taken_at: result.photo.taken_at,
      });
      setOpen(false);
      router.refresh();
    });
  };

  const removePhoto = () => {
    startTransition(async () => {
      setError(null);
      const result = await deleteGuestbookPhoto(photo.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDeleted?.(photo.id);
      router.refresh();
    });
  };

  return (
    <>
      <article className="relative overflow-hidden rounded-[20px] bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block aspect-[4/3] w-full bg-[#FBF0D0] text-left"
          aria-label="Edit caption and date"
        >
          <Image
            src={photo.displayUrl}
            alt={photo.caption ?? "Guestbook photo"}
            fill
            className="rounded-t-[16px] object-cover"
            sizes="(max-width: 640px) 100vw, 320px"
            unoptimized
          />
          <span className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-stone-900/45 text-white opacity-90 transition group-hover:bg-stone-900/65 group-hover:opacity-100">
            <Pencil className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </button>

        <div className="space-y-0.5 px-4 py-3">
          {photo.caption ? (
            <>
              <p className="text-[15px] font-medium text-stone-900">
                {photo.caption}
              </p>
              {dateLabel ? (
                <p className="text-sm text-stone-500">{dateLabel}</p>
              ) : null}
            </>
          ) : dateLabel ? (
            <p className="text-[15px] text-stone-600">{dateLabel}</p>
          ) : null}
        </div>
      </article>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <h2
                id={titleId}
                className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-stone-900"
              >
                Edit photo
              </h2>
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>

            <div className="relative mx-5 mt-5 aspect-[4/3] overflow-hidden rounded-[16px] bg-[#FBF0D0]">
              <Image
                src={photo.displayUrl}
                alt={photo.caption ?? "Guestbook photo"}
                fill
                className="object-cover"
                sizes="512px"
                unoptimized
              />
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-600">
                  Caption
                </span>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={200}
                  placeholder="Add a name or note"
                  disabled={pending}
                  className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-600">
                  Photo date
                </span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    disabled={pending}
                    className="min-h-[48px] min-w-0 flex-1 rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-base text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-50"
                  />
                  {dateValue ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setDateValue("")}
                      className="shrink-0 rounded-[14px] border border-stone-200 px-3 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <span className="mt-1.5 block text-xs text-stone-500">
                  Clear the date if it should stay hidden (upload time is not
                  shown).
                </span>
              </label>

              {error && (
                <p className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="min-h-[48px] flex-1 rounded-[14px] border border-stone-200 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveEdits}
                  className="min-h-[48px] flex-1 rounded-[14px] bg-[#F4B400] text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>

              {canDelete && (
                <div className="border-t border-stone-100 pt-4">
                  {!confirmRemove ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmRemove(true)}
                      className="w-full py-2 text-center text-sm font-medium text-red-700 transition hover:text-red-800 disabled:opacity-50"
                    >
                      Remove from guestbook
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-stone-600">
                        Remove this photo? This can&apos;t be undone.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmRemove(false)}
                          className="min-h-[44px] rounded-[12px] border border-stone-200 text-sm font-medium text-stone-700"
                        >
                          Keep
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
