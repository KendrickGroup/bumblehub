export type Recipe = {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  servings: number;
  hero_image_url: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  tags: string[] | null;
  created_by: string | null;
  source_url: string | null;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
  display_order: number;
};

export type RecipeStep = {
  id: string;
  recipe_id: string;
  step_number: number;
  title: string;
  content: string;
  timer_seconds: number | null;
};

export type RecipeChatMessage = {
  id: string;
  recipe_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type RecipeDetail = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

/** Structured draft from Claude / editor form (no DB ids yet). */
export type StructuredIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
};

export type StructuredStep = {
  title: string;
  content: string;
  timer_seconds: number | null;
};

export type StructuredRecipe = {
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  tags: string[];
  ingredients: StructuredIngredient[];
  steps: StructuredStep[];
  hero_image_url?: string | null;
  source_url?: string | null;
};
