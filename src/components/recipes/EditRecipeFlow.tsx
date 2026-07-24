"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecipeEditorForm } from "@/components/recipes/RecipeEditorForm";
import {
  deleteRecipe,
  updateRecipe,
} from "@/app/(app)/recipes/recipe-mutations";
import type { RecipeDetail, StructuredRecipe } from "@/lib/recipes/types";

type Props = {
  recipe: RecipeDetail;
  canDelete: boolean;
};

function toStructured(recipe: RecipeDetail): StructuredRecipe {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    total_minutes: recipe.total_minutes,
    tags: recipe.tags ?? [],
    hero_image_url: recipe.hero_image_url,
    source_url: recipe.source_url,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      notes: ing.notes,
    })),
    steps: recipe.steps.map((step) => ({
      title: step.title,
      content: step.content,
      timer_seconds: step.timer_seconds,
    })),
  };
}

export function EditRecipeFlow({ recipe, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async (draft: StructuredRecipe) => {
    setBusy(true);
    setError(null);
    try {
      const result = await updateRecipe(recipe.id, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/recipes/${recipe.id}?saved=1`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteRecipe(recipe.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/recipes");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-4">
      <header className="mb-6 px-1">
        <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          Edit recipe
        </p>
        <h1
          className="mt-1 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          {recipe.title}
        </h1>
      </header>
      <RecipeEditorForm
        initial={toStructured(recipe)}
        submitLabel="Save changes"
        cancelLabel="Cancel"
        onCancel={() => router.push(`/recipes/${recipe.id}`)}
        onSubmit={onSave}
        onDelete={onDelete}
        canDelete={canDelete}
        busy={busy}
        error={error}
      />
    </div>
  );
}
