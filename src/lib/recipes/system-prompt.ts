import type { RecipeDetail } from "./types";
import { formatIngredientLine, scaleAmount } from "./format-amount";

export function buildRecipeSystemPrompt(recipe: RecipeDetail): string {
  const ingredientLines = recipe.ingredients.map((ing) => {
    const scaled = scaleAmount(ing.amount, recipe.servings, recipe.servings);
    return `- ${formatIngredientLine(ing.name, scaled, ing.unit)}`;
  });

  const stepLines = recipe.steps.map(
    (step) =>
      `${step.step_number}. ${step.title}: ${step.content}${
        step.timer_seconds > 0
          ? ` (timer: ${Math.round(step.timer_seconds / 60)} min)`
          : ""
      }`,
  );

  const tags =
    recipe.tags && recipe.tags.length > 0
      ? recipe.tags.join(", ")
      : "none listed";

  return `You are a friendly, expert cooking helper inside BumbleHub. The user is currently cooking the following recipe. Answer their questions about substitutions, technique, timing, scaling, equipment alternatives, and pairings. Be concise and warm — they may have messy hands.

Here is the recipe:

Title: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ""}
Servings: ${recipe.servings}
${recipe.total_minutes ? `Total time: about ${recipe.total_minutes} minutes` : ""}
Tags: ${tags}

Ingredients:
${ingredientLines.join("\n")}

Steps:
${stepLines.join("\n")}`;
}
