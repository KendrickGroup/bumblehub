"use server";

import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { scaleAmount } from "@/lib/recipes/format-amount";
import type { RecipeIngredient } from "@/lib/recipes/types";

export type RecipeActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function insertRecipeChatMessage(
  recipeId: string,
  role: "user" | "assistant",
  content: string,
): Promise<RecipeActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return { ok: false, error: "No active hive configured." };
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!recipe) {
    return { ok: false, error: "Recipe not found." };
  }

  const { data, error } = await supabase
    .from("recipe_chats")
    .insert({ recipe_id: recipeId, role, content })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}

export async function addRecipeToShoppingList(
  recipeId: string,
  currentServings: number,
): Promise<RecipeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return { ok: false, error: "No active hive configured." };
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, servings")
    .eq("id", recipeId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (recipeError || !recipe) {
    return { ok: false, error: "Recipe not found." };
  }

  const { data: ingredients, error: ingError } = await supabase
    .from("recipe_ingredients")
    .select("name, amount, unit")
    .eq("recipe_id", recipeId)
    .order("display_order", { ascending: true });

  if (ingError) {
    return { ok: false, error: ingError.message };
  }

  const baseServings = recipe.servings as number;
  const rows = ((ingredients ?? []) as Pick<
    RecipeIngredient,
    "name" | "amount" | "unit"
  >[]).map((ing) => {
    const scaled = scaleAmount(ing.amount, currentServings, baseServings);
    return {
      property_id: propertyId,
      recipe_id: recipeId,
      name: ing.name,
      amount: scaled,
      unit: ing.unit,
      category: null,
      added_by: user.id,
    };
  });

  if (rows.length === 0) {
    return { ok: false, error: "No ingredients to add." };
  }

  const { error: insertError } = await supabase
    .from("shopping_list_items")
    .insert(rows);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}
