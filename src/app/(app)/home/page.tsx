import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countRecipesForProperty } from "@/lib/recipes/queries";
import type { Property, Scene } from "@/lib/types";
import { Clock } from "@/components/home/Clock";
import { SceneGrid } from "@/components/home/SceneGrid";
import { WeatherChip } from "@/components/home/WeatherChip";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("default_property_id")
    .eq("user_id", user!.id)
    .maybeSingle();

  let property: Property | null = null;
  let scenes: Scene[] = [];

  if (settings?.default_property_id) {
    const { data: propertyRow } = await supabase
      .from("properties")
      .select("id, name, slug, timezone")
      .eq("id", settings.default_property_id)
      .maybeSingle();

    property = propertyRow;

    if (property) {
      const { data: sceneRows } = await supabase
        .from("scenes")
        .select(
          "id, property_id, name, description, icon, accent_color, display_order, is_favorite",
        )
        .eq("property_id", property.id)
        .order("display_order", { ascending: true });

      scenes = sceneRows ?? [];
    }
  }

  const timezone = property?.timezone ?? "America/Chicago";

  let recipeCount = 0;
  if (property) {
    recipeCount = await countRecipesForProperty(property.id);
  }

  return (
    <>
      <header className="px-2 pt-6 pb-4 sm:px-0">
        <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          BumbleHub
        </p>
        <h1 className="text-2xl font-semibold text-stone-900">Home</h1>
      </header>

      <div className="flex flex-col gap-8">
        <section className="flex flex-wrap items-start justify-between gap-6">
          <Clock timezone={timezone} />
          <WeatherChip />
        </section>

        {!settings?.default_property_id && (
          <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            No default hive set. Add a{" "}
            <code className="font-mono text-xs">default_property_id</code> in{" "}
            <code className="font-mono text-xs">user_settings</code> for your
            account.
          </p>
        )}

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-stone-500">
            Recipes
          </h2>
          <Link
            href="/recipes"
            className="flex min-h-[88px] items-center gap-4 rounded-[20px] bg-white px-6 py-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#F4B400]/15 text-3xl">
              🍳
            </span>
            <div className="flex-1">
              <p className="text-lg font-semibold text-stone-900">Recipes</p>
              <p className="text-sm text-stone-500">
                {recipeCount === 0
                  ? "Cook-mode recipes for your hive"
                  : `${recipeCount} recipe${recipeCount === 1 ? "" : "s"} ready to cook`}
              </p>
            </div>
          </Link>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-stone-500">
            Guestbook
          </h2>
          <Link
            href="/guestbook"
            className="flex min-h-[88px] items-center gap-4 rounded-[20px] bg-white px-6 py-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#F4B400]/15 text-3xl">
              📸
            </span>
            <div>
              <p className="text-lg font-semibold text-stone-900">
                Add a guestbook photo
              </p>
              <p className="text-sm text-stone-500">
                Snap a selfie for the hive slideshow
              </p>
            </div>
          </Link>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-stone-500">
            Scenes
          </h2>
          <SceneGrid scenes={scenes} />
        </section>
      </div>
    </>
  );
}
