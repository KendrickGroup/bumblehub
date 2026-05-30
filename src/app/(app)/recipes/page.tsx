import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchRecipesForProperty } from "@/lib/recipes/queries";
import type { Recipe } from "@/lib/recipes/types";

export const metadata: Metadata = {
  title: "Recipes",
};

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const tags = (recipe.tags ?? []).slice(0, 2);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex flex-col overflow-hidden rounded-[20px] bg-white shadow-sm transition hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative aspect-[16/10] w-full bg-[#FBF0D0]">
        {recipe.hero_image_url ? (
          <Image
            src={recipe.hero_image_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 320px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            🍳
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold text-stone-900">{recipe.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
          {recipe.total_minutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
              {recipe.total_minutes} min
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default async function RecipesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;
  let recipes: Recipe[] = [];

  if (propertyId) {
    recipes = await fetchRecipesForProperty(propertyId);
  }

  return (
    <div className="py-4">
      <header className="mb-8 px-2 sm:px-0">
        <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          Recipes
        </p>
        <h1
          className="mt-1 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          What&apos;s cooking?
        </h1>
      </header>

      {!propertyId ? (
        <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Set a default hive in{" "}
          <code className="font-mono text-xs">user_settings</code> to see
          recipes.
        </p>
      ) : recipes.length === 0 ? (
        <p className="rounded-[20px] bg-white px-5 py-8 text-center text-stone-600 shadow-sm">
          No recipes yet for this hive.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
