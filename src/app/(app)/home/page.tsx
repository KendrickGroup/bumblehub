import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { countRecipesForProperty } from "@/lib/recipes/queries";
import type { Property, Scene, SceneAction } from "@/lib/types";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeMusicPill } from "@/components/home/HomeMusicPill";
import {
  LatigoRadioMark,
  SpotifyMark,
} from "@/components/music/AudioSourceMarks";
import { SceneGrid } from "@/components/home/SceneGrid";
import { VitalsTile } from "@/components/home/VitalsTile";
import { listSceneActions } from "@/lib/home-assistant/queries";
import { parseVitalsConfig } from "@/lib/home/vitals";
import {
  DEFAULT_HOUSE_GREETING,
  firstNameFromUser,
  parseHouseModeSettings,
} from "@/lib/house-mode/settings";
import HomeLoading from "./loading";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeCabin />
    </Suspense>
  );
}

async function HomeCabin() {
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
  let sceneActions: SceneAction[] = [];
  let houseGreeting = DEFAULT_HOUSE_GREETING;
  let vitalsConfig = parseVitalsConfig(null);
  let recipeCount = 0;

  if (settings?.default_property_id) {
    const propertyId = settings.default_property_id;
    const [propertyRes, sceneRes, settingsRes, recipes] = await Promise.all([
      supabase
        .from("properties")
        .select("id, name, slug, timezone")
        .eq("id", propertyId)
        .maybeSingle(),
      supabase
        .from("scenes")
        .select(
          "id, property_id, name, description, icon, accent_color, display_order, is_favorite, is_enabled",
        )
        .eq("property_id", propertyId)
        .eq("is_enabled", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("property_settings")
        .select("dashboard_layout")
        .eq("property_id", propertyId)
        .maybeSingle(),
      countRecipesForProperty(propertyId),
    ]);

    property = propertyRes.data;
    scenes = sceneRes.data ?? [];
    recipeCount = recipes;
    const layout = settingsRes.data?.dashboard_layout;
    houseGreeting = parseHouseModeSettings(layout).greeting;
    vitalsConfig = parseVitalsConfig(layout);

    if (property && scenes.length > 0) {
      try {
        sceneActions = await listSceneActions(scenes.map((s) => s.id));
      } catch {
        const { data: actionRows } = await supabase
          .from("scene_actions")
          .select(
            "id, scene_id, action_type, device_id, payload, delay_seconds, display_order",
          )
          .in(
            "scene_id",
            scenes.map((s) => s.id),
          );
        sceneActions = (actionRows ?? []) as SceneAction[];
      }
    }
  }

  const timezone = property?.timezone ?? "America/Los_Angeles";
  const firstName = firstNameFromUser({
    email: user?.email,
    user_metadata: user?.user_metadata as Record<string, unknown> | null,
  });

  const recipeLine =
    recipeCount === 0
      ? "Step-by-step with timers"
      : `${recipeCount} ready to cook — step-by-step with timers`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto max-md:overflow-y-auto md:overflow-hidden">
        <HomeHeader
          propertyName={property?.name ?? null}
          houseGreeting={houseGreeting}
          firstName={firstName}
          timezone={timezone}
        />

        {!settings?.default_property_id && (
          <p className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No default hive set. Add a{" "}
            <code className="font-mono text-xs">default_property_id</code> in{" "}
            <code className="font-mono text-xs">user_settings</code>.
          </p>
        )}

        <p className="secl mt-3">The Cabin</p>
        <div className="grid grid-cols-2 gap-3 max-[479px]:grid-cols-1">
          <Link href="/info" className="tile-card tile-info col-span-2 max-[479px]:col-span-1">
            <span className="tile-ic bg-white">📖</span>
            <span>
              <span className="tile-title">Cabin Info</span>
              <span className="tile-desc">
                Wi-Fi &amp; password · house guide · how everything works
              </span>
            </span>
          </Link>
          <div className="tile-card tile-music">
            <span className="tile-ic-btns">
              <Link
                href="/music"
                prefetch={false}
                className="tile-ic-btn"
                aria-label="Open Latigo Radio"
              >
                <LatigoRadioMark size={32} />
              </Link>
              <Link
                href="/music?source=spotify"
                prefetch={false}
                className="tile-ic-btn"
                aria-label="Open Spotify"
              >
                <SpotifyMark size={17} tone="current" />
              </Link>
            </span>
            <Link href="/music" prefetch={false} className="tile-music-copy">
              <span className="tile-title">Music</span>
              <span className="tile-desc">
                Latigo Radio &amp; Spotify playlists
              </span>
            </Link>
          </div>
          <Link href="/recipes" prefetch={false} className="tile-card">
            <span className="tile-ic">🍳</span>
            <span>
              <span className="tile-title">Recipes</span>
              <span className="tile-desc">{recipeLine}</span>
            </span>
          </Link>
          <Link href="/hive" prefetch={false} className="tile-card">
            <span className="tile-ic">📷</span>
            <span>
              <span className="tile-title">Guestbook</span>
              <span className="tile-desc">
                Old-time portraits — dress up, hang it on the wall, take one
                home
              </span>
            </span>
          </Link>
          <VitalsTile config={vitalsConfig} />
        </div>

        <p className="secl mt-3.5">Scenes</p>
        <SceneGrid scenes={scenes} actions={sceneActions} />
      </div>

      <div className="shrink-0 pt-3">
        <HomeMusicPill />
      </div>
    </div>
  );
}
