import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import { fetchRecipeDetail } from "@/lib/recipes/queries";
import { EditRecipeFlow } from "@/components/recipes/EditRecipeFlow";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ? `Edit · ${data.title}` : "Edit recipe" };
}

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;
  if (!propertyId || !user) {
    redirect("/recipes");
  }

  const recipe = await fetchRecipeDetail(id, propertyId);
  if (!recipe) {
    notFound();
  }

  const owner = await isPropertyOwner(propertyId, user.id);
  const canDelete = owner || recipe.created_by === user.id;

  return <EditRecipeFlow recipe={recipe} canDelete={canDelete} />;
}
