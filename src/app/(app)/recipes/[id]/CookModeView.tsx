"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
} from "lucide-react";
import {
  formatIngredientAmount,
  scaleAmount,
} from "@/lib/recipes/format-amount";
import type { RecipeChatMessage, RecipeDetail } from "@/lib/recipes/types";
import { addRecipeToShoppingList } from "../actions";
import { RecipeChat } from "./RecipeChat";
import { RecipeTimer } from "./RecipeTimer";

type Props = {
  recipe: RecipeDetail;
  initialChats: RecipeChatMessage[];
  showSavedToast?: boolean;
};

export function CookModeView({
  recipe,
  initialChats,
  showSavedToast = false,
}: Props) {
  const router = useRouter();
  const [servings, setServings] = useState(recipe.servings);
  const [stepIndex, setStepIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!showSavedToast) return;
    setToast("Recipe saved.");
    const id = window.setTimeout(() => setToast(null), 2800);
    router.replace(`/recipes/${recipe.id}`, { scroll: false });
    return () => window.clearTimeout(id);
  }, [showSavedToast, recipe.id, router]);

  const steps = recipe.steps;
  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];
  const firstIngredient = recipe.ingredients[0]?.name ?? "this ingredient";

  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients.map((ing) => ({
        ...ing,
        scaled:
          ing.amount == null
            ? null
            : scaleAmount(ing.amount, servings, recipe.servings),
      })),
    [recipe.ingredients, recipe.servings, servings],
  );

  const showToastMessage = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const goPrevious = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    } else {
      router.push("/recipes");
    }
  };

  const handleAddToList = async () => {
    setListBusy(true);
    const result = await addRecipeToShoppingList(recipe.id, servings);
    setListBusy(false);
    if (result.ok) {
      showToastMessage("Added to shopping list.");
    } else {
      showToastMessage(result.error);
    }
  };

  return (
    <div className="relative -mx-4 sm:mx-0">
      {toast && (
        <div
          className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 rounded-[18px] border border-[#F4B400]/40 bg-[#FBF0D0] px-5 py-3 text-sm font-medium text-stone-900 shadow-md"
          role="status"
        >
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid gap-6 max-[899px]:grid-cols-1 min-[900px]:grid-cols-[280px_1fr_320px] min-[900px]:items-start">
          <aside className="min-[900px]:sticky min-[900px]:top-6 min-[900px]:max-h-[calc(100vh-3rem)] min-[900px]:overflow-y-auto">
            <div className="rounded-[20px] border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/recipes"
                  className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                  Back to recipes
                </Link>
                <Link
                  href={`/recipes/${recipe.id}/edit`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-[14px] px-3 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                  aria-label="Edit recipe"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
              </div>
              <h1
                className="mt-3 font-[family-name:var(--font-fraunces)] text-2xl font-semibold leading-tight text-stone-900 sm:text-[1.65rem]"
                style={{ fontVariationSettings: '"opsz" 72' }}
              >
                {recipe.title}
              </h1>

              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-600">
                  Servings
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease servings"
                    disabled={servings <= 1}
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
                  >
                    <Minus className="h-5 w-5" strokeWidth={2} />
                  </button>
                  <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums">
                    {servings}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase servings"
                    disabled={servings >= 99}
                    onClick={() => setServings((s) => Math.min(99, s + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <ul className="mt-5 space-y-3 border-t border-stone-100 pt-5">
                {scaledIngredients.map((ing) => (
                  <li key={ing.id} className="text-[15px] leading-snug">
                    {ing.scaled == null ? (
                      <span className="text-stone-900">
                        {ing.name}
                        {ing.notes ? (
                          <span className="text-stone-500"> — {ing.notes}</span>
                        ) : null}
                      </span>
                    ) : ing.unit ? (
                      <>
                        <span className="font-medium text-stone-900">
                          {ing.name}
                        </span>
                        <span className="mt-0.5 block text-stone-600">
                          {formatIngredientAmount(ing.scaled, ing.unit)}
                          {ing.notes ? ` · ${ing.notes}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-stone-900">
                        {formatIngredientAmount(ing.scaled, null)} {ing.name}
                        {ing.notes ? (
                          <span className="text-stone-500"> — {ing.notes}</span>
                        ) : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={listBusy}
                onClick={() => void handleAddToList()}
                className="mt-6 min-h-[56px] w-full rounded-[18px] border-2 border-[#F4B400]/50 bg-[#F4B400]/10 text-base font-semibold text-stone-900 transition hover:border-[#F4B400] hover:bg-[#F4B400]/20 disabled:opacity-50"
              >
                {listBusy ? "Adding…" : "Add to shopping list"}
              </button>
            </div>
          </aside>

          <section className="min-w-0">
            {currentStep ? (
              <div className="rounded-[20px] border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Step {currentStep.step_number} of {totalSteps}
                      {currentStep.title ? ` · ${currentStep.title}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={goPrevious}
                      disabled={stepIndex === 0}
                      aria-label="Previous step"
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-6 w-6" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex min-h-[56px] items-center gap-1 rounded-[18px] bg-[#F4B400] px-5 text-base font-semibold text-stone-900 transition hover:bg-[#e0a800]"
                    >
                      {stepIndex >= totalSteps - 1 ? "Done" : "Next"}
                      {stepIndex < totalSteps - 1 && (
                        <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[19px] leading-[1.5] text-stone-800 sm:text-[21px]">
                  {currentStep.content}
                </p>

                {currentStep.timer_seconds != null &&
                  currentStep.timer_seconds > 0 && (
                    <RecipeTimer timerSeconds={currentStep.timer_seconds} />
                  )}

                <div className="mt-8 flex items-center justify-center gap-2">
                  {steps.map((step, index) => (
                    <span
                      key={step.id}
                      className={`h-2.5 rounded-full transition-all ${
                        index < stepIndex
                          ? "w-2.5 bg-stone-800"
                          : index === stepIndex
                            ? "w-8 bg-[#F4B400]"
                            : "w-2.5 bg-stone-200"
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-[20px] bg-white p-8 text-stone-600 shadow-sm">
                No steps found for this recipe.
              </p>
            )}

            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border border-stone-200 bg-white text-base font-semibold text-stone-900 shadow-sm min-[900px]:hidden"
            >
              <MessageCircle className="h-5 w-5 text-[#F4B400]" strokeWidth={2} />
              Ask about this recipe
            </button>
          </section>

          <div className="hidden min-[900px]:block min-[900px]:sticky min-[900px]:top-6 min-[900px]:max-h-[calc(100vh-3rem)]">
            <RecipeChat
              recipeId={recipe.id}
              initialMessages={initialChats}
              firstIngredientName={firstIngredient}
            />
          </div>
        </div>
      </div>

      <RecipeChat
        recipeId={recipe.id}
        initialMessages={initialChats}
        firstIngredientName={firstIngredient}
        sheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
