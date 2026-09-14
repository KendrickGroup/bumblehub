"use client";

import { useEffect, useMemo, useState } from "react";
import type { Scene, SceneAction } from "@/lib/types";
import { runSceneActions } from "@/lib/home-assistant/run-scene";

const LAST_SCENE_KEY = "bumblehub:last-scene";

type TileStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; message: string }
  | { kind: "partial"; message: string }
  | { kind: "offline"; message: string };

const IDLE: TileStatus = { kind: "idle" };

function readLastScene(fallback: string | null): string | null {
  if (typeof window === "undefined") return fallback;
  try {
    return sessionStorage.getItem(LAST_SCENE_KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

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

  useEffect(() => {
    const stored = readLastScene(null);
    if (stored && scenes.some((s) => s.id === stored)) {
      setActiveId(stored);
    }
  }, [scenes]);
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
    try {
      sessionStorage.setItem(LAST_SCENE_KEY, scene.id);
    } catch {
      /* ignore */
    }
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
      <p className="rounded-[16px] border border-dashed border-stone-200 bg-white/60 px-5 py-6 text-center text-sm text-stone-500">
        No scenes on the home screen yet. Enable them in Settings.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 max-[479px]:grid-cols-1">
      {scenes.map((scene) => {
        const active = scene.id === activeId;
        const status = statusById[scene.id] ?? IDLE;
        const running = status.kind === "running";
        return (
          <button
            key={scene.id}
            type="button"
            disabled={Boolean(runningId)}
            onClick={() => void activate(scene)}
            className={`rounded-2xl p-[13px_16px] text-left shadow-[0_3px_10px_rgba(60,50,35,.08)] transition active:scale-[0.98] disabled:cursor-wait ${
              running ? "scene-shimmer" : ""
            } ${
              active
                ? "bg-[#FFF7E0] shadow-[inset_0_0_0_1.5px_#F0D98A,0_3px_10px_rgba(60,50,35,.08)]"
                : "bg-white"
            }`}
          >
            {active ? (
              <span className="float-right text-[9px] font-extrabold tracking-widest text-[#B8912E]">
                ACTIVE
              </span>
            ) : null}
            <div className="text-[14px] font-extrabold text-[#241A12]">
              {scene.name}
            </div>
            {status.kind === "done" ||
            status.kind === "partial" ||
            status.kind === "offline" ? (
              <div
                className={`mt-[3px] text-[10.5px] leading-snug ${
                  status.kind === "offline"
                    ? "text-stone-500"
                    : status.kind === "partial"
                      ? "text-amber-800"
                      : "text-stone-600"
                }`}
              >
                {status.message}
              </div>
            ) : scene.description ? (
              <div className="mt-[3px] text-[10.5px] leading-snug text-[#8A7F6E]">
                {scene.description}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
