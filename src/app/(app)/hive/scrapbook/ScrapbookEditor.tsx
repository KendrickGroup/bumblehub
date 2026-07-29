"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  RotateCcw,
  Sticker,
  Type,
  Undo2,
  Palette,
} from "lucide-react";
import type { GuestbookPhoto } from "@/lib/photos";
import { BACKGROUNDS, backgroundCss } from "@/lib/scrapbook/backgrounds";
import { flattenScrapbook } from "@/lib/scrapbook/flatten";
import { stickerDefaultSize, STICKERS, StickerSvg } from "@/lib/scrapbook/stickers";
import { loadStickerImage } from "@/lib/scrapbook/sticker-markup";
import { useScrapbookFonts } from "@/lib/scrapbook/useScrapbookFonts";
import {
  CANVAS_H,
  CANVAS_W,
  FONT_LABELS,
  TEXT_COLORS,
  type ScrapbookBgId,
  type ScrapbookDoc,
  type ScrapbookFontId,
  type ScrapbookObject,
  type ScrapbookStickerId,
  type ScrapbookTextColor,
  type TextObject,
} from "@/lib/scrapbook/types";
import { saveGuestbookPhoto } from "@/app/(app)/guestbook/actions";
import { ScrapbookCanvas } from "./ScrapbookCanvas";

type Props = {
  photos: GuestbookPhoto[];
  hasProperty: boolean;
};

type Sheet = "none" | "bg" | "photos" | "stickers" | "text";

function uid() {
  return crypto.randomUUID();
}

function emptyDoc(): ScrapbookDoc {
  return { background: "linen", objects: [], nextZ: 1 };
}

function CelebrationBees() {
  const paths = [
    { top: "28%", delay: "0ms", dy: -24 },
    { top: "46%", delay: "90ms", dy: 12 },
    { top: "64%", delay: "160ms", dy: -10 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {paths.map((p, i) => (
        <span
          key={i}
          className="booth-bee absolute h-4 w-5 rounded-full bg-[#F4B400] shadow-sm"
          style={{
            top: p.top,
            left: "-8%",
            ["--bee-dy" as string]: `${p.dy}px`,
            animationDelay: p.delay,
          }}
        />
      ))}
      <style>{`
        .booth-bee { animation: boothBeeFlit 0.65s ease-out both; }
        .booth-bee::before, .booth-bee::after {
          content: ""; position: absolute; top: -2px; width: 10px; height: 8px;
          background: rgba(255,255,255,0.85); border-radius: 50%;
        }
        .booth-bee::before { left: -4px; }
        .booth-bee::after { right: -4px; }
        @keyframes boothBeeFlit {
          0% { transform: translate(0,0) rotate(-10deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(112vw, var(--bee-dy)) rotate(16deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function ScrapbookEditor({ photos, hasProperty }: Props) {
  useScrapbookFonts();
  const [doc, setDoc] = useState<ScrapbookDoc>(emptyDoc);
  const [undoSnapshot, setUndoSnapshot] = useState<ScrapbookDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const editingTextId = selectedId;
  const textObj = doc.objects.find(
    (o): o is TextObject => o.id === editingTextId && o.type === "text",
  );
  const [textDraft, setTextDraft] = useState("");
  const textCommitted = useRef("");
  const textDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitGesture = useCallback(() => {
    // Continuous transforms already live in doc; undo was snapshotted at gesture start.
  }, []);

  const snapshotBefore = useCallback(() => {
    setUndoSnapshot(structuredClone(doc));
  }, [doc]);

  const updateObject = useCallback(
    (id: string, patch: Partial<ScrapbookObject>) => {
      setDoc((prev) => ({
        ...prev,
        objects: prev.objects.map((o) =>
          o.id === id ? ({ ...o, ...patch } as ScrapbookObject) : o,
        ),
      }));
    },
    [],
  );

  const bringToFront = useCallback((id: string) => {
    setDoc((prev) => {
      const nextZ = prev.nextZ + 1;
      return {
        ...prev,
        nextZ,
        objects: prev.objects.map((o) =>
          o.id === id ? { ...o, zIndex: nextZ } : o,
        ),
      };
    });
  }, []);

  const deleteObject = useCallback(
    (id: string) => {
      snapshotBefore();
      setDoc((prev) => ({
        ...prev,
        objects: prev.objects.filter((o) => o.id !== id),
      }));
      setSelectedId((s) => (s === id ? null : s));
      setSheet("none");
    },
    [snapshotBefore],
  );

  const undo = () => {
    if (!undoSnapshot) return;
    setDoc(undoSnapshot);
    setUndoSnapshot(null);
    setSelectedId(null);
  };

  const startOver = () => {
    if (!window.confirm("Clear the whole page and start over?")) return;
    snapshotBefore();
    setDoc(emptyDoc());
    setSelectedId(null);
    setSheet("none");
  };

  const setBackground = (id: ScrapbookBgId) => {
    snapshotBefore();
    setDoc((prev) => ({ ...prev, background: id }));
    setSheet("none");
  };

  const addPhoto = (photo: GuestbookPhoto) => {
    snapshotBefore();
    const width = CANVAS_W * 0.4;
    const height = width * 0.75;
    const rot = (Math.random() * 6 - 3);
    setDoc((prev) => {
      const z = prev.nextZ + 1;
      const obj: ScrapbookObject = {
        id: uid(),
        type: "photo",
        photoId: photo.id,
        src: photo.displayUrl,
        x: CANVAS_W / 2 + (Math.random() * 40 - 20),
        y: CANVAS_H / 2 + (Math.random() * 40 - 20),
        width,
        height,
        rotation: rot,
        zIndex: z,
      };
      return { ...prev, nextZ: z, objects: [...prev.objects, obj] };
    });
    setSheet("none");
  };

  const addSticker = (stickerId: ScrapbookStickerId) => {
    snapshotBefore();
    const size = stickerDefaultSize(stickerId);
    setDoc((prev) => {
      const z = prev.nextZ + 1;
      const obj: ScrapbookObject = {
        id: uid(),
        type: "sticker",
        stickerId,
        x: CANVAS_W / 2 + (Math.random() * 80 - 40),
        y: CANVAS_H / 2 + (Math.random() * 80 - 40),
        width: size.width,
        height: size.height,
        rotation: Math.random() * 10 - 5,
        zIndex: z,
      };
      return { ...prev, nextZ: z, objects: [...prev.objects, obj] };
    });
    setSheet("none");
  };

  const addText = () => {
    snapshotBefore();
    setDoc((prev) => {
      const z = prev.nextZ + 1;
      const id = uid();
      const obj: TextObject = {
        id,
        type: "text",
        text: "Tap to edit",
        font: "marker",
        color: "#1a1a1a",
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        width: 360,
        height: 80,
        rotation: Math.random() * 4 - 2,
        zIndex: z,
      };
      setSelectedId(id);
      setTextDraft(obj.text);
      textCommitted.current = obj.text;
      setSheet("text");
      return { ...prev, nextZ: z, objects: [...prev.objects, obj] };
    });
  };

  const openTextEdit = (id: string) => {
    const obj = doc.objects.find((o) => o.id === id);
    if (!obj || obj.type !== "text") return;
    setSelectedId(id);
    setTextDraft(obj.text);
    textCommitted.current = obj.text;
    setSheet("text");
  };

  useEffect(() => {
    if (sheet !== "text" || !textObj) return;
    setTextDraft(textObj.text);
    textCommitted.current = textObj.text;
  }, [sheet, textObj?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushText = useCallback(() => {
    if (textDebounce.current) {
      clearTimeout(textDebounce.current);
      textDebounce.current = null;
    }
    if (!textObj) return;
    const next = textDraft;
    if (next === textCommitted.current) return;
    textCommitted.current = next;
    updateObject(textObj.id, { text: next });
  }, [textDraft, textObj, updateObject]);

  const onTextInput = (value: string) => {
    setTextDraft(value);
    if (textDebounce.current) clearTimeout(textDebounce.current);
    textDebounce.current = setTimeout(() => {
      textDebounce.current = null;
      if (!textObj) return;
      textCommitted.current = value;
      updateObject(textObj.id, { text: value });
    }, 400);
  };

  const save = async () => {
    if (!hasProperty) return;
    if (doc.objects.length === 0) {
      setSaveError("Add something to the page first.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      flushText();
      const stickerImgs = new Map<string, HTMLImageElement>();
      for (const o of doc.objects) {
        if (o.type === "sticker" && !stickerImgs.has(o.stickerId)) {
          stickerImgs.set(o.stickerId, await loadStickerImage(o.stickerId));
        }
      }
      const blob = await flattenScrapbook(doc, (ctx, id, size) => {
        const img = stickerImgs.get(id);
        if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
      });
      if (!blob) throw new Error("Could not render page");

      const form = new FormData();
      form.set("photo", blob, "scrapbook.jpg");
      form.set("category", "scrapbook");
      form.set("taken_at", new Date().toISOString());
      if (caption.trim()) form.set("caption", caption.trim());
      const result = await saveGuestbookPhoto(form);
      if (!result.ok) throw new Error(result.error);
      setDone(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const makeAnother = () => {
    setDoc(emptyDoc());
    setSelectedId(null);
    setCaption("");
    setDone(false);
    setSheet("none");
    setUndoSnapshot(null);
  };

  const memoryPhotos = useMemo(() => photos, [photos]);

  if (!hasProperty) {
    return (
      <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Set a default home to use the scrapbook.
      </p>
    );
  }

  if (done) {
    return (
      <div className="relative px-2 py-10 text-center sm:px-0">
        <CelebrationBees />
        <p
          className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          You&apos;re on the wall!
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={makeAnother}
            className="inline-flex min-h-[56px] items-center justify-center rounded-[18px] bg-[#F4B400] px-8 text-base font-semibold text-stone-900"
          >
            Make another
          </button>
          <Link
            href="/hive"
            className="text-sm font-medium text-stone-500 underline-offset-2 hover:underline"
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-2 pb-4 sm:px-0">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1
            className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900"
            style={{ fontVariationSettings: '"opsz" 72' }}
          >
            Scrapbook
          </h1>
          <p className="text-sm text-stone-500">Make a page for the wall</p>
        </div>
        <Link
          href="/hive"
          className="text-sm font-medium text-stone-500 underline-offset-2 hover:underline"
        >
          Back to booth
        </Link>
      </header>

      <ScrapbookCanvas
        doc={doc}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChangeObject={updateObject}
        onBringToFront={bringToFront}
        onDelete={deleteObject}
        onEditText={openTextEdit}
        onCommitGesture={commitGesture}
        onGestureStart={snapshotBefore}
      />

      {/* Toolbar */}
      <div className="mt-3 grid grid-cols-6 gap-1 rounded-[18px] bg-white p-2 shadow-sm">
        {(
          [
            { id: "bg" as const, label: "BG", icon: Palette, action: () => setSheet("bg") },
            { id: "photos" as const, label: "Photo", icon: ImagePlus, action: () => setSheet("photos") },
            { id: "stickers" as const, label: "Stickers", icon: Sticker, action: () => setSheet("stickers") },
            { id: "text" as const, label: "Text", icon: Type, action: addText },
            { id: "undo" as const, label: "Undo", icon: Undo2, action: undo },
            { id: "reset" as const, label: "Reset", icon: RotateCcw, action: startOver },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.action}
            disabled={item.id === "undo" && !undoSnapshot}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[12px] text-stone-700 transition hover:bg-[#FAF8F3] disabled:opacity-40"
          >
            <item.icon className="h-5 w-5 text-[#E0972B]" strokeWidth={2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-stone-600">
          Name your masterpiece{" "}
          <span className="font-normal text-stone-400">(optional)</span>
        </span>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={120}
          placeholder="Summer board…"
          className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
        />
      </label>

      {saveError && (
        <p className="mt-2 text-sm text-amber-800">{saveError}</p>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-3 inline-flex min-h-[56px] w-full items-center justify-center rounded-[18px] bg-[#F4B400] text-base font-semibold text-stone-900 disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add to the wall"}
      </button>

      {/* Sheets */}
      {sheet !== "none" && sheet !== "text" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40"
          onClick={() => setSheet("none")}
        >
          <div
            className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sheet === "bg" && (
              <>
                <h2 className="mb-4 text-lg font-semibold text-stone-900">Background</h2>
                <div className="grid grid-cols-5 gap-2">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBackground(bg.id)}
                      className={`overflow-hidden rounded-[14px] border-2 ${
                        doc.background === bg.id
                          ? "border-[#F4B400]"
                          : "border-transparent"
                      }`}
                    >
                      <span
                        className="block aspect-square w-full"
                        style={backgroundCss(bg.id)}
                      />
                      <span className="block truncate px-1 py-1 text-center text-[10px] font-medium text-stone-600">
                        {bg.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {sheet === "photos" && (
              <>
                <h2 className="mb-4 text-lg font-semibold text-stone-900">
                  Add a photo
                </h2>
                {memoryPhotos.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    No memories on the wall yet. Snap one in the Photo Booth
                    first.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {memoryPhotos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addPhoto(p)}
                        className="aspect-square overflow-hidden rounded-[12px] bg-stone-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.displayUrl}
                          alt={p.caption ?? ""}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {sheet === "stickers" && (
              <>
                <h2 className="mb-4 text-lg font-semibold text-stone-900">
                  Stickers
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  {STICKERS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addSticker(s.id)}
                      className="flex aspect-square items-center justify-center rounded-[14px] bg-[#FAF8F3] p-2"
                      aria-label={s.label}
                    >
                      <StickerSvg id={s.id} className="h-full w-full" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sheet === "text" && textObj && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40"
          onClick={() => {
            flushText();
            setSheet("none");
          }}
        >
          <div
            className="w-full max-w-lg rounded-t-[22px] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold text-stone-900">
              Edit text
            </h2>
            <input
              type="text"
              value={textDraft}
              onChange={(e) => onTextInput(e.target.value)}
              onBlur={flushText}
              maxLength={80}
              className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-500">
              Font
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(FONT_LABELS) as ScrapbookFontId[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    snapshotBefore();
                    updateObject(textObj.id, { font: f });
                  }}
                  className={`min-h-[48px] rounded-[12px] px-3 text-left text-base ${
                    textObj.font === f
                      ? "bg-[#F4B400] text-stone-900"
                      : "border border-stone-200 bg-white"
                  }`}
                  style={{ fontFamily: fontFamilyPreview(f) }}
                >
                  {FONT_LABELS[f]}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-500">
              Color
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => {
                    snapshotBefore();
                    updateObject(textObj.id, { color: c as ScrapbookTextColor });
                  }}
                  className={`h-11 w-11 rounded-full border-2 ${
                    textObj.color === c
                      ? "border-[#F4B400]"
                      : "border-stone-200"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                flushText();
                setSheet("none");
              }}
              className="mt-5 min-h-[48px] w-full rounded-[14px] bg-stone-900 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fontFamilyPreview(f: ScrapbookFontId): string {
  switch (f) {
    case "marker":
      return '"Permanent Marker", cursive';
    case "fraunces":
      return "var(--font-fraunces), Georgia, serif";
    case "slab":
      return '"Alfa Slab One", Georgia, serif';
    case "typewriter":
      return '"Special Elite", monospace';
  }
}
