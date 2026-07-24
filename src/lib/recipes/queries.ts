import { createClient } from "@/lib/supabase/server";
import type {
  Recipe,
  RecipeChatMessage,
  RecipeDetail,
  RecipeIngredient,
  RecipeStep,
} from "./types";

const RECIPE_COLUMNS =
  "id, property_id, title, description, servings, hero_image_url, prep_minutes, cook_minutes, total_minutes, tags, created_by, source_url";

export async function fetchRecipesForProperty(
  propertyId: string,
): Promise<Recipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("property_id", propertyId)
    .order("title", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Recipe[];
}

export async function countRecipesForProperty(
  propertyId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchRecipeDetail(
  recipeId: string,
  propertyId: string,
): Promise<RecipeDetail | null> {
  const supabase = await createClient();

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("id", recipeId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (recipeError) throw new Error(recipeError.message);
  if (!recipe) return null;

  const [{ data: ingredients, error: ingError }, { data: steps, error: stepError }] =
    await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select("id, recipe_id, name, amount, unit, notes, display_order")
        .eq("recipe_id", recipeId)
        .order("display_order", { ascending: true }),
      supabase
        .from("recipe_steps")
        .select("id, recipe_id, step_number, title, content, timer_seconds")
        .eq("recipe_id", recipeId)
        .order("step_number", { ascending: true }),
    ]);

  if (ingError) throw new Error(ingError.message);
  if (stepError) throw new Error(stepError.message);

  return {
    ...(recipe as Recipe),
    ingredients: (ingredients ?? []) as RecipeIngredient[],
    steps: (steps ?? []) as RecipeStep[],
  };
}

export async function fetchRecipeChats(
  recipeId: string,
): Promise<RecipeChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_chats")
    .select("id, recipe_id, role, content, created_at")
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as RecipeChatMessage[];
}
