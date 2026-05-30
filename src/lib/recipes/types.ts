export type Recipe = {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  servings: number;
  hero_image_url: string | null;
  total_minutes: number | null;
  tags: string[] | null;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  name: string;
  amount: number;
  unit: string | null;
  display_order: number;
};

export type RecipeStep = {
  id: string;
  recipe_id: string;
  step_number: number;
  title: string;
  content: string;
  timer_seconds: number;
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
