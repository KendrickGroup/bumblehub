import type { Metadata } from "next";
import { StubPage } from "@/components/shell/StubPage";

export const metadata: Metadata = {
  title: "Recipes",
};

export default function RecipesPage() {
  return (
    <StubPage
      title="Recipes"
      description="Cook-mode recipes with step-by-step guidance and AI chat will live here."
    />
  );
}
