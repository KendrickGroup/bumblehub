"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Scene } from "@/lib/types";

type Props = {
  hasProperty: boolean;
  initialScenes: Scene[];
};

export function HomeScenesPanel({ hasProperty, initialScenes }: Props) {
  const [scenes, setScenes] = useState(initialScenes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...scenes].sort((a, b) => a.display_order - b.display_order),
    [scenes],
  );

  const persist = async (next: Scene[]) => {
    setSaving(true);
    setError(null);
    setStatus(null);
    setScenes(next);
    try {
      const response = await fetch("/api/scenes/home", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: next.map((scene, index) => ({
            id: scene.id,
            is_enabled: scene.is_enabled,
            display_order: index,
            description: scene.description ?? "",
          })),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        scenes?: Scene[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save scenes");
      }
      if (body.scenes) setScenes(body.scenes);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scenes");
    } finally {
      setSaving(false);
    }
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = ordered.findIndex((s) => s.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const copy = [...ordered];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item!);
    void persist(copy.map((scene, display_order) => ({ ...scene, display_order })));
  };

  if (!hasProperty) {
    return null;
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
        Home
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        Scenes on the home screen. Hide ones guests shouldn&apos;t see, and
        write a short description so a first-time visitor knows what the tap
        does.
      </p>

      {ordered.length === 0 ? (
        <p className="mt-5 text-sm text-stone-500">No scenes for this hive.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {ordered.map((scene, index) => (
            <li
              key={scene.id}
              className="rounded-[16px] border border-stone-100 bg-[#FAF8F3] p-4"
            >
              <div className="flex items-center gap-3">
                <label className="flex min-h-[44px] flex-1 items-center gap-3 text-base font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={scene.is_enabled}
                    disabled={saving}
                    onChange={(e) => {
                      void persist(
                        ordered.map((s) =>
                          s.id === scene.id
                            ? { ...s, is_enabled: e.target.checked }
                            : s,
                        ),
                      );
                    }}
                    className="h-5 w-5 accent-[#F4B400]"
                  />
                  {scene.name}
                </label>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={saving || index === 0}
                    onClick={() => move(scene.id, -1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={saving || index === ordered.length - 1}
                    onClick={() => move(scene.id, 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white disabled:opacity-40"
                  >
                    <ArrowDown className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
                  Guest description
                </span>
                <input
                  type="text"
                  defaultValue={scene.description ?? ""}
                  disabled={saving}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next === (scene.description ?? "")) return;
                    void persist(
                      ordered.map((s) =>
                        s.id === scene.id ? { ...s, description: next } : s,
                      ),
                    );
                  }}
                  placeholder="One tap when you walk in"
                  className="min-h-[44px] w-full rounded-[12px] border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#F4B400] focus:outline-none"
                />
              </label>
              <p className="mt-2 text-xs text-stone-400">
                {scene.is_enabled ? "Shown on Home" : "Hidden from Home"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {status ? <p className="mt-3 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-amber-800">{error}</p> : null}
    </section>
  );
}
