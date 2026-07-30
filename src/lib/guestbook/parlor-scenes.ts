/** Illustrated parlor scenes — drop replacement files in public/parlor-scenes/. */

export type ParlorSceneId = "saloon" | "ok-corral" | "barn";

export type ParlorSceneDef = {
  id: ParlorSceneId;
  name: string;
  /** Public URL under /parlor-scenes */
  url: string;
};

export const PARLOR_SCENES: ParlorSceneDef[] = [
  {
    id: "saloon",
    name: "The Saloon",
    url: "/parlor-scenes/saloon.jpg",
  },
  {
    id: "ok-corral",
    name: "OK Corral",
    url: "/parlor-scenes/ok-corral.jpg",
  },
  {
    id: "barn",
    name: "The Barn",
    url: "/parlor-scenes/barn.jpg",
  },
];

export function getParlorScene(id: string | null): ParlorSceneDef | undefined {
  if (!id) return undefined;
  return PARLOR_SCENES.find((s) => s.id === id);
}
