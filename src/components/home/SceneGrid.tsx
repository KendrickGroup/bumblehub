"use client";

import { useMemo, useState } from "react";
import {
  Coffee,
  Film,
  Home,
  Moon,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { Scene, SceneAction } from "@/lib/types";
import { runSceneActions } from "@/lib/home-assistant/run-scene";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  sun: Sun,
  moon: Moon,
  coffee: Coffee,
  film: Film,
  sparkles: Sparkles,
};

function sceneIcon(name: string | null): LucideIcon {
  if (!name) return Sparkles;
  return ICONS[name.toLowerCase()] ?? Sparkles;
}

type TileStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; message: string }
  | { kind: "partial"; message: string }
  | { kind: "offline"; message: string };

const IDLE: TileStatus = { kind: "idle" };

export function SceneGrid({
  scenes,
  actions,
}: {
  scenes: Scene[];
  actions: SceneAction[];
}) {
  const initial =
    scenes.find((s) => s.is_favorite)?.id ?? scenes[0]?.id ?? null;
  const [activeId, setActiveId] = useState<string | null>(initial);
  const [statusById, setStatusById] = useState<Record<string, TileStatus>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  const actionsByScene = useMemo(() => {
    const map = new Map<string, SceneAction[]>();
    for (const action of actions) {
      const list = map.get(action.scene_id) ?? [];
      list.push(action);
      map.set(action.scene_id, list);
    }
    return map;
  }, [actions]);

  const activate = async (scene: Scene) => {
    if (runningId) return;
    setActiveId(scene.id);
    const sceneActions = actionsByScene.get(scene.id) ?? [];
    if (sceneActions.length === 0) return;

    setRunningId(scene.id);
    setStatusById((prev) => ({ ...prev, [scene.id]: { kind: "running" } }));

    try {
      const result = await runSceneActions(sceneActions);
      let next: TileStatus = IDLE;
      if (result.deviceTotal > 0 && result.unreachable && result.deviceOk === 0) {
        next = {
          kind: "offline",
          message: "Can't reach the house right now",
        };
      } else if (result.deviceTotal > 0 && result.deviceOk < result.deviceTotal) {
        next = {
          kind: "partial",
          message: `${result.deviceOk} of ${result.deviceTotal} devices responded`,
        };
      } else if (result.deviceTotal > 0) {
        next = {
          kind: "done",
          message: `Done — ${result.deviceTotal} device${
            result.deviceTotal === 1 ? "" : "s"
          } set`,
        };
      }

      if (next.kind !== "idle") {
        setStatusById((prev) => ({ ...prev, [scene.id]: next }));
        window.setTimeout(() => {
          setStatusById((prev) => ({ ...prev, [scene.id]: IDLE }));
        }, 2000);
      } else {
        setStatusById((prev) => ({ ...prev, [scene.id]: IDLE }));
      }
    } catch {
      setStatusById((prev) => ({
        ...prev,
        [scene.id]: {
          kind: "offline",
          message: "Can't reach the house right now",
        },
      }));
      window.setTimeout(() => {
        setStatusById((prev) => ({ ...prev, [scene.id]: IDLE }));
      }, 2000);
    } finally {
      setRunningId(null);
    }
  };

  if (scenes.length === 0) {
    return (
      <p className="rounded-[20px] border border-dashed border-stone-200 bg-white/60 px-6 py-10 text-center text-stone-500">
        No scenes yet for this hive.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {scenes.map((scene) => {
        const Icon = sceneIcon(scene.icon);
        const active = scene.id === activeId;
        const status = statusById[scene.id] ?? IDLE;
        const running = status.kind === "running";
        return (
          <button
            key={scene.id}
            type="button"
            disabled={Boolean(runningId)}
            onClick={() => void activate(scene)}
            className={`relative flex min-h-[88px] flex-col items-start justify-between overflow-hidden rounded-[20px] border-2 p-5 text-left transition ${
              running ? "scene-shimmer" : ""
            } ${
              active
                ? "border-[#F4B400] bg-[#F4B400]/10 shadow-sm"
                : "border-transparent bg-white shadow-sm hover:border-stone-200"
            } disabled:cursor-wait`}
          >
            <Icon
              className={`h-7 w-7 ${active ? "text-[#F4B400]" : "text-stone-500"}`}
              strokeWidth={1.75}
            />
            <div className="mt-4">
              <span className="block text-lg font-medium text-stone-900">
                {scene.name}
              </span>
              {status.kind === "done" ||
              status.kind === "partial" ||
              status.kind === "offline" ? (
                <span
                  className={`mt-1 block text-sm leading-snug ${
                    status.kind === "offline"
                      ? "text-stone-500"
                      : status.kind === "partial"
                        ? "text-amber-800"
                        : "text-stone-600"
                  }`}
                >
                  {status.message}
                </span>
              ) : scene.description ? (
                <span className="mt-1 block text-sm leading-snug text-stone-500">
                  {scene.description}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
