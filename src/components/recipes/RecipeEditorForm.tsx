"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Minus,
  Plus,
  X,
} from "lucide-react";
import {
  downscaleImageFile,
  secondsToTimerParts,
  timerPartsToSeconds,
} from "@/lib/recipes/image";
import { uploadRecipeHeroImage } from "@/app/(app)/recipes/recipe-mutations";
import type { StructuredRecipe } from "@/lib/recipes/types";

type Props = {
  initial: StructuredRecipe;
  submitLabel: string;
  onSubmit: (recipe: StructuredRecipe) => Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  /** Show delete control at bottom (edit mode). */
  onDelete?: () => Promise<void>;
  canDelete?: boolean;
};

export function RecipeEditorForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "Start over",
  busy = false,
  error = null,
  onDelete,
  canDelete = false,
}: Props) {
  const [recipe, setRecipe] = useState<StructuredRecipe>(initial);
  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<StructuredRecipe>) => {
    setRecipe((prev) => ({ ...prev, ...patch }));
  };

  const setIngredient = (
    index: number,
    patch: Partial<StructuredRecipe["ingredients"][number]>,
  ) => {
    setRecipe((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, ...patch } : ing,
      ),
    }));
  };

  const setStep = (
    index: number,
    patch: Partial<StructuredRecipe["steps"][number]>,
  ) => {
    setRecipe((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, ...patch } : step,
      ),
    }));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setRecipe((prev) => {
      const next = [...prev.steps];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return { ...prev, steps: next };
    });
  };

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase();
    if (!tag) return;
    if (recipe.tags.includes(tag)) {
      setTagDraft("");
      return;
    }
    update({ tags: [...recipe.tags, tag].slice(0, 8) });
    setTagDraft("");
  };

  const onPickPhoto = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setLocalError(null);
    try {
      const blob = await downscaleImageFile(file);
      const formData = new FormData();
      formData.append("photo", blob, "hero.jpg");
      const result = await uploadRecipeHeroImage(formData);
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }
      update({ hero_image_url: result.url });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);
    await onSubmit(recipe);
  };

  const displayError = error ?? localError;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-4">
      {/* Hero image */}
      <section className="overflow-hidden rounded-[20px] bg-white shadow-sm">
        <div className="relative aspect-[16/10] bg-[#FBF0D0]">
          {recipe.hero_image_url ? (
            <Image
              src={recipe.hero_image_url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-500">
              <span className="text-5xl">🍳</span>
              <span className="text-sm">Optional hero photo</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={busy || uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-[16px] bg-[#F4B400] px-4 text-sm font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={2} />
            {uploading
              ? "Uploading…"
              : recipe.hero_image_url
                ? "Replace photo"
                : "Add a photo"}
          </button>
          {recipe.hero_image_url && (
            <button
              type="button"
              disabled={busy || uploading}
              onClick={() => update({ hero_image_url: null })}
              className="min-h-[48px] rounded-[16px] border border-stone-200 px-4 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Remove photo
            </button>
          )}
        </div>
      </section>

      {/* Basics */}
      <section className="space-y-4 rounded-[20px] bg-white p-5 shadow-sm sm:p-6">
        <label className="block">
          <span className="text-sm font-medium text-stone-600">Title</span>
          <input
            value={recipe.title}
            onChange={(e) => update({ title: e.target.value })}
            className="mt-2 min-h-[52px] w-full rounded-[14px] border border-stone-200 px-4 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            style={{ fontVariationSettings: '"opsz" 72' }}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-stone-600">Description</span>
          <textarea
            value={recipe.description ?? ""}
            onChange={(e) => update({ description: e.target.value || null })}
            rows={3}
            className="mt-2 w-full rounded-[14px] border border-stone-200 px-4 py-3 text-base text-stone-800 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
          />
        </label>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="text-sm font-medium text-stone-600">Servings</span>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease servings"
                disabled={recipe.servings <= 1}
                onClick={() =>
                  update({ servings: Math.max(1, recipe.servings - 1) })
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums">
                {recipe.servings}
              </span>
              <button
                type="button"
                aria-label="Increase servings"
                disabled={recipe.servings >= 99}
                onClick={() =>
                  update({ servings: Math.min(99, recipe.servings + 1) })
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {(
            [
              ["prep_minutes", "Prep min"],
              ["cook_minutes", "Cook min"],
              ["total_minutes", "Total min"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-stone-600">{label}</span>
              <input
                type="number"
                min={0}
                value={recipe[key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update({
                    [key]: v === "" ? null : Number(v),
                  } as Partial<StructuredRecipe>);
                }}
                className="mt-2 w-24 min-h-[48px] rounded-[14px] border border-stone-200 px-3 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
              />
            </label>
          ))}
        </div>

        <div>
          <span className="text-sm font-medium text-stone-600">Tags</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  update({ tags: recipe.tags.filter((t) => t !== tag) })
                }
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-[#F4B400]/15 px-3 text-sm font-medium text-stone-800"
              >
                {tag}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag"
              className="min-h-[48px] flex-1 rounded-[14px] border border-stone-200 px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            />
            <button
              type="button"
              onClick={addTag}
              className="min-h-[48px] rounded-[14px] border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Ingredients */}
      <section className="rounded-[20px] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Ingredients
        </h2>
        <div className="mt-4 space-y-3">
          {recipe.ingredients.map((ing, index) => (
            <div
              key={index}
              className="grid grid-cols-[4.5rem_5rem_1fr_auto] gap-2 sm:grid-cols-[5rem_6rem_1fr_1fr_auto]"
            >
              <input
                type="number"
                step="any"
                placeholder="Amt"
                value={ing.amount ?? ""}
                onChange={(e) =>
                  setIngredient(index, {
                    amount: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="min-h-[48px] rounded-[12px] border border-stone-200 px-2 text-sm focus:border-[#F4B400] focus:outline-none"
              />
              <input
                placeholder="Unit"
                value={ing.unit ?? ""}
                onChange={(e) =>
                  setIngredient(index, { unit: e.target.value || null })
                }
                className="min-h-[48px] rounded-[12px] border border-stone-200 px-2 text-sm focus:border-[#F4B400] focus:outline-none"
              />
              <input
                placeholder="Name"
                value={ing.name}
                onChange={(e) => setIngredient(index, { name: e.target.value })}
                className="min-h-[48px] rounded-[12px] border border-stone-200 px-3 text-sm focus:border-[#F4B400] focus:outline-none sm:col-span-1"
              />
              <input
                placeholder="Notes"
                value={ing.notes ?? ""}
                onChange={(e) =>
                  setIngredient(index, { notes: e.target.value || null })
                }
                className="col-span-3 min-h-[48px] rounded-[12px] border border-stone-200 px-3 text-sm focus:border-[#F4B400] focus:outline-none sm:col-span-1"
              />
              <button
                type="button"
                aria-label="Remove ingredient"
                onClick={() =>
                  setRecipe((prev) => ({
                    ...prev,
                    ingredients: prev.ingredients.filter((_, i) => i !== index),
                  }))
                }
                className="flex h-12 w-12 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setRecipe((prev) => ({
              ...prev,
              ingredients: [
                ...prev.ingredients,
                { name: "", amount: null, unit: null, notes: null },
              ],
            }))
          }
          className="mt-4 min-h-[48px] rounded-[14px] border border-dashed border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:border-[#F4B400]/60"
        >
          Add ingredient
        </button>
      </section>

      {/* Steps */}
      <section className="space-y-4">
        <h2 className="px-1 text-sm font-medium uppercase tracking-wide text-stone-500">
          Steps
        </h2>
        {recipe.steps.map((step, index) => {
          const timer = secondsToTimerParts(step.timer_seconds);
          return (
            <article
              key={index}
              className="rounded-[20px] bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Step {index + 1}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Move step up"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move step down"
                    disabled={index === recipe.steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove step"
                    onClick={() =>
                      setRecipe((prev) => ({
                        ...prev,
                        steps: prev.steps.filter((_, i) => i !== index),
                      }))
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <input
                value={step.title}
                onChange={(e) => setStep(index, { title: e.target.value })}
                placeholder="Title (e.g. Searing)"
                className="mt-3 min-h-[48px] w-full rounded-[14px] border border-stone-200 px-4 text-base font-medium focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
              />
              <textarea
                value={step.content}
                onChange={(e) => setStep(index, { content: e.target.value })}
                rows={4}
                placeholder="What to do…"
                className="mt-3 w-full rounded-[14px] border border-stone-200 px-4 py-3 text-base leading-relaxed focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-stone-500">Timer</span>
                <input
                  type="number"
                  min={0}
                  placeholder="min"
                  value={timer.minutes}
                  onChange={(e) =>
                    setStep(index, {
                      timer_seconds: timerPartsToSeconds(
                        e.target.value,
                        timer.seconds,
                      ),
                    })
                  }
                  className="w-20 min-h-[44px] rounded-[12px] border border-stone-200 px-2 text-sm"
                />
                <span className="text-stone-400">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="sec"
                  value={timer.seconds}
                  onChange={(e) =>
                    setStep(index, {
                      timer_seconds: timerPartsToSeconds(
                        timer.minutes,
                        e.target.value,
                      ),
                    })
                  }
                  className="w-20 min-h-[44px] rounded-[12px] border border-stone-200 px-2 text-sm"
                />
              </div>
            </article>
          );
        })}
        <button
          type="button"
          onClick={() =>
            setRecipe((prev) => ({
              ...prev,
              steps: [
                ...prev.steps,
                { title: "", content: "", timer_seconds: null },
              ],
            }))
          }
          className="min-h-[48px] rounded-[14px] border border-dashed border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:border-[#F4B400]/60"
        >
          Add step
        </button>
      </section>

      {displayError && (
        <p className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={busy || uploading}
          onClick={() => void handleSubmit()}
          className="min-h-[56px] flex-1 rounded-[18px] bg-[#F4B400] text-base font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[56px] rounded-[18px] px-6 text-base font-medium text-stone-500 transition hover:text-stone-800 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        )}
      </div>

      {canDelete && onDelete && (
        <div className="border-t border-stone-200 pt-8">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Delete this recipe permanently? This can’t be undone.",
                )
              ) {
                void onDelete();
              }
            }}
            className="min-h-[52px] w-full rounded-[16px] border border-red-200 bg-white text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            Delete recipe
          </button>
        </div>
      )}
    </div>
  );
}
