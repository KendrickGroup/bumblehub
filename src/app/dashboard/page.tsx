import { redirect } from "next/navigation";
import { CloudSun } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Property, Scene } from "@/lib/types";
import { Clock } from "./Clock";
import { MusicTile } from "./MusicTile";
import { NowPlayingStrip } from "./NowPlayingStrip";
import { SceneGrid } from "./SceneGrid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("default_property_id")
    .eq("user_id", user.id)
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

  return (
    <div className="flex min-h-full flex-col bg-[#FAF8F3]">
      <header className="flex items-center justify-between px-6 pt-8 pb-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-[#F4B400]">
            BumbleHub
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">
            {property?.name ?? "Your hive"}
          </h1>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-stone-600 hover:bg-white/80"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 pb-10">
        <section className="flex flex-wrap items-start justify-between gap-6">
          <Clock timezone={timezone} />
          <div className="flex min-h-[60px] items-center gap-3 rounded-[20px] bg-white px-5 py-4 shadow-sm">
            <CloudSun className="h-8 w-8 text-stone-400" strokeWidth={1.5} />
            <div>
              <p className="text-sm text-stone-500">Weather</p>
              <p className="text-lg font-medium text-stone-800">— °</p>
            </div>
          </div>
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
            Music
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MusicTile />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-stone-500">
            Scenes
          </h2>
          <SceneGrid scenes={scenes} />
        </section>
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200/80 bg-[#FAF8F3]/95 px-6 py-4 backdrop-blur">
        <NowPlayingStrip />
      </footer>
    </div>
  );
}
