import type { Metadata } from "next";
import { NewRecipeFlow } from "@/components/recipes/NewRecipeFlow";

export const metadata: Metadata = {
  title: "Add recipe",
};

export default function NewRecipePage() {
  return <NewRecipeFlow />;
}
