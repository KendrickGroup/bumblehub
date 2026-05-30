import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  fetchRecipeChats,
  fetchRecipeDetail,
} from "@/lib/recipes/queries";
import { CookModeView } from "./CookModeView";

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
  return { title: data?.title ?? "Cook mode" };
}

export default async function RecipeCookPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;
  if (!propertyId) {
    redirect("/recipes");
  }

  const recipe = await fetchRecipeDetail(id, propertyId);
  if (!recipe) {
    notFound();
  }

  const chats = await fetchRecipeChats(id);

  return <CookModeView recipe={recipe} initialChats={chats} />;
}
