"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecipeEditorForm } from "@/components/recipes/RecipeEditorForm";
import { saveNewRecipe } from "@/app/(app)/recipes/recipe-mutations";
import type { StructuredRecipe } from "@/lib/recipes/types";

type Phase = "input" | "loading" | "review";

export function NewRecipeFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<StructuredRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const structure = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Paste a recipe, a link, or a short description first.");
      return;
    }
    setError(null);
    setPhase("loading");
    try {
      const response = await fetch("/api/recipes/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      const body = (await response.json()) as {
        error?: string;
        recipe?: StructuredRecipe;
      };
      if (!response.ok || !body.recipe) {
        setError(body.error ?? "Couldn’t structure that recipe.");
        setPhase("input");
        return;
      }
      setDraft(body.recipe);
      setPhase("review");
    } catch {
      setError("Something went wrong. Try again in a moment.");
      setPhase("input");
    }
  };

  const onSave = async (recipe: StructuredRecipe) => {
    setBusy(true);
    setError(null);
    try {
      const result = await saveNewRecipe(recipe);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/recipes/${result.id}?saved=1`);
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="h-12 w-12 animate-pulse rounded-full bg-[#F4B400]/30" />
        <p className="mt-6 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900">
          Reading the recipe…
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Turning your paste into steps you can cook from.
        </p>
      </div>
    );
  }

  if (phase === "review" && draft) {
    return (
      <div className="py-4">
        <header className="mb-6 px-1">
          <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
            New recipe
          </p>
          <h1
            className="mt-1 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
            style={{ fontVariationSettings: '"opsz" 72' }}
          >
            Review & save
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Tweak anything before it lands in your hive.
          </p>
        </header>
        <RecipeEditorForm
          key={draft.title + String(draft.ingredients.length)}
          initial={draft}
          submitLabel="Save recipe"
          cancelLabel="Start over"
          onCancel={() => {
            setDraft(null);
            setPhase("input");
            setError(null);
          }}
          onSubmit={onSave}
          busy={busy}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <header className="mb-8 px-1">
        <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          New recipe
        </p>
        <h1
          className="mt-1 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          Add a recipe
        </h1>
        <p className="mt-2 text-base text-stone-600">
          Paste text, drop a link, or describe what you make. We&apos;ll
          structure it for cook mode.
        </p>
      </header>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={14}
        placeholder="Paste a recipe, a link, or just describe what you make…"
        className="w-full rounded-[20px] border border-stone-200 bg-white px-5 py-4 text-base leading-relaxed text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
      />

      {error && (
        <p className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void structure()}
        className="mt-6 min-h-[56px] w-full rounded-[18px] bg-[#F4B400] text-base font-semibold text-stone-900 transition hover:bg-[#e0a800]"
      >
        Continue
      </button>
    </div>
  );
}
