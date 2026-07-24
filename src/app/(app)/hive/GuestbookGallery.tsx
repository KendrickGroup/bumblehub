"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Images, Plus, Upload } from "lucide-react";
import type { GuestbookPhoto } from "@/lib/photos";
import { downscaleImageFile } from "@/lib/images/downscale";
import { saveGuestbookPhoto } from "@/app/(app)/guestbook/actions";
import { GuestbookCard } from "./GuestbookCard";
import { StartSlideshowButton } from "./StartSlideshowButton";

type Props = {
  initialPhotos: GuestbookPhoto[];
  canDelete: boolean;
};

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

/** True when the device likely supports file drag-and-drop. */
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

export function GuestbookGallery({ initialPhotos, canDelete }: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [caption, setCaption] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const canDragDrop = useFinePointerDrag();

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const openPicker = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const images = files.filter(isImageFile);
      const rejected = files.length - images.length;

      if (rejected > 0 && images.length === 0) {
        setError("Those weren’t images. Try JPEG, PNG, or HEIC photos.");
        return;
      }
      if (rejected > 0) {
        setError(
          `Skipped ${rejected} non-image file${rejected === 1 ? "" : "s"}.`,
        );
      } else {
        setError(null);
      }
      if (images.length === 0) return;

      const batchCaption = caption.trim() || null;
      setProgress({ done: 0, total: images.length });

      let okCount = 0;
      let failCount = 0;

      for (let i = 0; i < images.length; i++) {
        const file = images[i]!;
        try {
          let blob: Blob;
          try {
            blob = await downscaleImageFile(file);
          } catch {
            failCount += 1;
            setError(
              "Couldn’t read that image. Try JPEG or PNG (some HEIC files need converting first).",
            );
            setProgress({ done: i + 1, total: images.length });
            continue;
          }

          const formData = new FormData();
          formData.append(
            "photo",
            new File([blob], "guestbook.jpg", { type: "image/jpeg" }),
          );
          if (batchCaption) formData.append("caption", batchCaption);

          const result = await saveGuestbookPhoto(formData);
          if (!result.ok) {
            failCount += 1;
            setError(result.error);
          } else {
            okCount += 1;
            setPhotos((prev) => {
              if (prev.some((p) => p.id === result.photo.id)) return prev;
              return [result.photo, ...prev];
            });
          }
        } catch {
          failCount += 1;
        }
        setProgress({ done: i + 1, total: images.length });
      }

      setProgress(null);
      if (okCount > 0) {
        showToast(
          okCount === 1
            ? "Photo added to the guestbook."
            : `${okCount} photos added to the guestbook.`,
        );
        setCaption("");
      }
      if (failCount > 0) {
        setError(
          failCount === images.length
            ? "Couldn’t upload those photos. Try again."
            : `${failCount} photo${failCount === 1 ? "" : "s"} failed to upload.`,
        );
      }
    },
    [caption, showToast],
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      void uploadFiles(e.dataTransfer.files);
    }
  };

  const uploading = progress != null;

  return (
    <div
      className="relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {toast && (
        <div
          className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-[18px] border border-[#F4B400]/40 bg-[#FBF0D0] px-5 py-3 text-sm font-medium text-stone-900 shadow-md"
          role="status"
        >
          {toast}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex min-h-[280px] items-center justify-center rounded-[20px] border-2 border-dashed border-[#F4B400] bg-[#F4B400]/15 backdrop-blur-[1px]">
          <p className="px-6 text-center text-lg font-semibold text-stone-900">
            Drop photos to add them to the guestbook
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/guestbook"
          className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-[#F4B400] px-5 text-base font-semibold text-stone-900 transition hover:bg-[#e0a800]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} />
          Add to the guestbook
        </Link>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void uploadFiles(e.target.files);
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={openPicker}
          className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] border-2 border-[#F4B400]/50 bg-white px-5 text-base font-semibold text-stone-900 transition hover:border-[#F4B400] hover:bg-[#F4B400]/10 disabled:opacity-50"
        >
          <Upload className="h-5 w-5 text-[#F4B400]" strokeWidth={2.25} />
          Upload photos
        </button>

        <StartSlideshowButton />
      </div>

      <label className="mb-6 block">
        <span className="mb-1.5 block text-sm font-medium text-stone-600">
          Caption for this upload{" "}
          <span className="font-normal text-stone-400">(optional)</span>
        </span>
        <input
          type="text"
          value={caption}
          disabled={uploading}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g. Weekend at the cabin"
          maxLength={200}
          className="min-h-[48px] w-full max-w-xl rounded-[14px] border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-50"
        />
      </label>

      {progress && (
        <div className="mb-4 rounded-[16px] border border-[#F4B400]/30 bg-[#FBF0D0]/60 px-4 py-3">
          <p className="text-sm font-medium text-stone-800">
            Uploading {progress.done} of {progress.total}…
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200/80">
            <div
              className="h-full rounded-full bg-[#F4B400] transition-[width] duration-200"
              style={{
                width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </p>
      )}

      {/* Desktop drop invitation — hidden on touch (Upload button is enough) */}
      {canDragDrop && photos.length > 0 && (
        <button
          type="button"
          disabled={uploading}
          onClick={openPicker}
          className="mb-5 flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-stone-300/90 bg-[#FBF7EF] px-5 py-5 text-center transition hover:border-[#F4B400] hover:bg-[#F4B400]/10 disabled:opacity-50"
        >
          <Images
            className="mb-1 h-6 w-6 text-[#E0972B]"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="text-sm font-semibold text-stone-800">
            Drag photos here to add them
          </span>
          <span className="text-xs text-stone-500">
            or use Upload photos above
          </span>
        </button>
      )}

      {photos.length === 0 ? (
        <button
          type="button"
          disabled={uploading}
          onClick={openPicker}
          className="flex min-h-[220px] w-full flex-col items-center rounded-2xl border-2 border-dashed border-stone-300/90 bg-[#FBF7EF] px-6 py-14 text-center transition hover:border-[#F4B400] hover:bg-[#F4B400]/10 disabled:opacity-50"
        >
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#F4B400]/15 text-[#F4B400]">
            <Camera className="h-8 w-8" strokeWidth={1.75} />
          </span>
          <p className="text-lg font-semibold text-stone-900">
            The guestbook is empty. Be the first!
          </p>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            {canDragDrop
              ? "Take a photo, upload from your device, or drag pictures right here."
              : "Take a photo or tap Upload photos to add pictures from your library."}
          </p>
        </button>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <GuestbookCard
              key={photo.id}
              photo={photo}
              canDelete={canDelete}
              onDeleted={(id) =>
                setPhotos((prev) => prev.filter((p) => p.id !== id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
