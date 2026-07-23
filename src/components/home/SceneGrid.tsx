"use client";

import { useState } from "react";
import {
  Coffee,
  Film,
  Home,
  Moon,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { Scene } from "@/lib/types";

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

export function SceneGrid({ scenes }: { scenes: Scene[] }) {
  const initial =
    scenes.find((s) => s.is_favorite)?.id ?? scenes[0]?.id ?? null;
  const [activeId, setActiveId] = useState<string | null>(initial);

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
        return (
          <button
            key={scene.id}
            type="button"
            onClick={() => setActiveId(scene.id)}
            className={`flex min-h-[88px] flex-col items-start justify-between rounded-[20px] border-2 p-5 text-left transition ${
              active
                ? "border-[#F4B400] bg-[#F4B400]/10 shadow-sm"
                : "border-transparent bg-white shadow-sm hover:border-stone-200"
            }`}
          >
            <Icon
              className={`h-7 w-7 ${active ? "text-[#F4B400]" : "text-stone-500"}`}
              strokeWidth={1.75}
            />
            <div className="mt-4">
              <span className="block text-lg font-medium text-stone-900">
                {scene.name}
              </span>
              {scene.description ? (
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
