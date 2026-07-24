"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import {
  RECIPES_BUCKET,
  recipesStoragePath,
  storagePathFromRecipeUrl,
} from "@/lib/recipes/storage";
import type { StructuredRecipe } from "@/lib/recipes/types";

export type RecipeMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type UploadHeroResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

async function ensureRecipesBucket(): Promise<void> {
  try {
    const admin = createServiceClient();
    const { data } = await admin.storage.getBucket(RECIPES_BUCKET);
    if (data) return;
    await admin.storage.createBucket(RECIPES_BUCKET, {
      public: true,
      fileSizeLimit: 10_485_760,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
  } catch {
    // Policies may still need the SQL migration; upload will surface errors.
  }
}

function normalizeRecipePayload(recipe: StructuredRecipe) {
  return {
    title: recipe.title.trim(),
    description: recipe.description?.trim() || null,
    servings: Math.max(1, Math.min(99, Math.round(recipe.servings || 4))),
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    total_minutes: recipe.total_minutes,
    tags: (recipe.tags ?? []).map((t) => t.trim()).filter(Boolean),
    hero_image_url: recipe.hero_image_url ?? null,
    source_url: recipe.source_url ?? null,
  };
}

export async function uploadRecipeHeroImage(
  formData: FormData,
): Promise<UploadHeroResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) return { ok: false, error: "No active hive configured." };

  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "No photo provided." };
  }

  await ensureRecipesBucket();

  const imageId = crypto.randomUUID();
  const path = recipesStoragePath(propertyId, imageId);

  const { error: uploadError } = await supabase.storage
    .from(RECIPES_BUCKET)
    .upload(path, file, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(RECIPES_BUCKET).getPublicUrl(path);

  return { ok: true, url: publicUrl };
}

export async function saveNewRecipe(
  recipe: StructuredRecipe,
): Promise<RecipeMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) return { ok: false, error: "No active hive configured." };

  if (!recipe.title?.trim()) return { ok: false, error: "Title is required." };
  if (!recipe.ingredients?.length) {
    return { ok: false, error: "Add at least one ingredient." };
  }
  if (!recipe.steps?.length) {
    return { ok: false, error: "Add at least one step." };
  }

  const payload = normalizeRecipePayload(recipe);

  const { data: inserted, error } = await supabase
    .from("recipes")
    .insert({
      property_id: propertyId,
      created_by: user.id,
      ...payload,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Failed to save recipe." };
  }

  const recipeId = inserted.id as string;

  const ingRows = recipe.ingredients.map((ing, index) => ({
    recipe_id: recipeId,
    name: ing.name.trim(),
    amount: ing.amount,
    unit: ing.unit?.trim() || null,
    notes: ing.notes?.trim() || null,
    display_order: index,
  }));

  const stepRows = recipe.steps.map((step, index) => ({
    recipe_id: recipeId,
    step_number: index + 1,
    title: step.title.trim() || `Step ${index + 1}`,
    content: step.content.trim(),
    timer_seconds: step.timer_seconds,
  }));

  const { error: ingError } = await supabase
    .from("recipe_ingredients")
    .insert(ingRows);
  if (ingError) {
    await supabase.from("recipes").delete().eq("id", recipeId);
    return { ok: false, error: ingError.message };
  }

  const { error: stepError } = await supabase
    .from("recipe_steps")
    .insert(stepRows);
  if (stepError) {
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
    await supabase.from("recipes").delete().eq("id", recipeId);
    return { ok: false, error: stepError.message };
  }

  return { ok: true, id: recipeId };
}

export async function updateRecipe(
  recipeId: string,
  recipe: StructuredRecipe,
): Promise<RecipeMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) return { ok: false, error: "No active hive configured." };

  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Recipe not found." };

  if (!recipe.title?.trim()) return { ok: false, error: "Title is required." };
  if (!recipe.ingredients?.length) {
    return { ok: false, error: "Add at least one ingredient." };
  }
  if (!recipe.steps?.length) {
    return { ok: false, error: "Add at least one step." };
  }

  const payload = normalizeRecipePayload(recipe);
  const { error: updateError } = await supabase
    .from("recipes")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", recipeId)
    .eq("property_id", propertyId);

  if (updateError) return { ok: false, error: updateError.message };

  await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  await supabase.from("recipe_steps").delete().eq("recipe_id", recipeId);

  const ingRows = recipe.ingredients.map((ing, index) => ({
    recipe_id: recipeId,
    name: ing.name.trim(),
    amount: ing.amount,
    unit: ing.unit?.trim() || null,
    notes: ing.notes?.trim() || null,
    display_order: index,
  }));

  const stepRows = recipe.steps.map((step, index) => ({
    recipe_id: recipeId,
    step_number: index + 1,
    title: step.title.trim() || `Step ${index + 1}`,
    content: step.content.trim(),
    timer_seconds: step.timer_seconds,
  }));

  const { error: ingError } = await supabase
    .from("recipe_ingredients")
    .insert(ingRows);
  if (ingError) return { ok: false, error: ingError.message };

  const { error: stepError } = await supabase
    .from("recipe_steps")
    .insert(stepRows);
  if (stepError) return { ok: false, error: stepError.message };

  return { ok: true, id: recipeId };
}

export async function deleteRecipe(
  recipeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) return { ok: false, error: "No active hive configured." };

  const { data: existing } = await supabase
    .from("recipes")
    .select("id, created_by, hero_image_url")
    .eq("id", recipeId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Recipe not found." };

  const isOwner = await isPropertyOwner(propertyId, user.id);
  const isCreator = existing.created_by === user.id;
  if (!isOwner && !isCreator) {
    return { ok: false, error: "Only the creator or hive owner can delete." };
  }

  const heroUrl = existing.hero_image_url as string | null;
  if (heroUrl) {
    const path = storagePathFromRecipeUrl(heroUrl);
    if (path) {
      await supabase.storage.from(RECIPES_BUCKET).remove([path]);
    }
  }

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("property_id", propertyId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
