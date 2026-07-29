import type { ReactNode } from "react";

/** Swap art later by changing `svg` (or adding `url`) — ids stay stable. */
export type ParlorPropDef = {
  id: string;
  name: string;
  shelf: "costume" | "prop";
  /** Inline SVG markup (viewBox 0 0 64 64). Preferred for placeholders. */
  svg: string;
  /** Optional future raster / etched-art URL — when set, UI + flatten prefer it. */
  url?: string;
  defaultSize?: number;
};

export type PortraitPropObject = {
  id: string;
  propId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

/** Logical canvas matching scrapbook (4:3) for gesture math. */
export const PORTRAIT_CANVAS_W = 1200;
export const PORTRAIT_CANVAS_H = 900;
export const PORTRAIT_MIN_PROP = 40;
export const PORTRAIT_MAX_PROP_FRAC = 0.9;

const S = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">${paths}</svg>`;

export const PARLOR_PROPS: ParlorPropDef[] = [
  {
    id: "dress",
    name: "Prairie dress",
    shelf: "costume",
    defaultSize: 280,
    svg: S(
      `<path d="M26 10h12l2 8-4 6h-8l-4-6z" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><path d="M28 24l-9 28c8 4 18 4 26 0l-9-28" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><path d="M22 42h20M24 47h16" stroke="#3E2A1E" stroke-width="1.6"/>`,
    ),
  },
  {
    id: "vest",
    name: "Vest & star",
    shelf: "costume",
    defaultSize: 260,
    svg: S(
      `<path d="M22 12l-6 10 4 30h10l-2-24 4-10z" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><path d="M42 12l6 10-4 30H34l2-24-4-10z" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><path d="M23 34l1.2 2.8 3 .3-2.2 2 .6 3-2.6-1.6-2.6 1.6.6-3-2.2-2 3-.3z" stroke="#3E2A1E" stroke-width="1.8"/>`,
    ),
  },
  {
    id: "gun-belt",
    name: "Gun belt & holster",
    shelf: "costume",
    defaultSize: 300,
    svg: S(
      `<path d="M10 24h44v8H10z" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 32v6c0 8 4 10 4 14l6-2c2-6-2-10-2-18" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="28" r="1.4" fill="#3E2A1E"/><circle cx="28" cy="28" r="1.4" fill="#3E2A1E"/><circle cx="36" cy="28" r="1.4" fill="#3E2A1E"/>`,
    ),
  },
  {
    id: "duster",
    name: "Duster coat",
    shelf: "costume",
    defaultSize: 300,
    svg: S(
      `<path d="M24 12h16l6 8-4 34h-6l-4-26-4 26h-6l-4-34z" stroke="#3E2A1E" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 12l8 8 8-8" stroke="#3E2A1E" stroke-width="1.8"/>`,
    ),
  },
  {
    id: "hat",
    name: "Cowboy hat",
    shelf: "costume",
    defaultSize: 320,
    svg: S(
      `<path d="M14 38c0-4 6-16 18-16s18 12 18 16" fill="#3E2A1E"/><ellipse cx="32" cy="40" rx="26" ry="7" fill="#3E2A1E"/><path d="M20 37h24" stroke="#F4B400" stroke-width="4"/>`,
    ),
  },
  {
    id: "badge",
    name: "Sheriff badge",
    shelf: "prop",
    defaultSize: 140,
    svg: S(
      `<path d="M32 8l6 8 10-2-2 10 8 6-8 6 2 10-10-2-6 8-6-8-10 2 2-10-8-6 8-6-2-10 10 2z" fill="#F4B400" stroke="#B8860B" stroke-width="2"/><circle cx="32" cy="32" r="9" fill="#FAF3E3"/>`,
    ),
  },
  {
    id: "horseshoe",
    name: "Horseshoe",
    shelf: "prop",
    defaultSize: 180,
    svg: S(
      `<path d="M18 46V30c0-9 6-16 14-16s14 7 14 16v16" fill="none" stroke="#5C4430" stroke-width="8" stroke-linecap="round"/><circle cx="18" cy="46" r="3" fill="#F4B400"/><circle cx="46" cy="46" r="3" fill="#F4B400"/>`,
    ),
  },
  {
    id: "lasso",
    name: "Lasso",
    shelf: "prop",
    defaultSize: 220,
    svg: S(
      `<circle cx="36" cy="26" r="14" fill="none" stroke="#8A5A2B" stroke-width="5"/><path d="M26 37c-8 6-12 12-10 18" fill="none" stroke="#8A5A2B" stroke-width="5" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "branding-iron",
    name: "Branding iron",
    shelf: "prop",
    defaultSize: 220,
    svg: S(
      `<path d="M12 52L34 30" stroke="#5C4430" stroke-width="6" stroke-linecap="round"/><rect x="32" y="12" width="20" height="20" rx="4" fill="none" stroke="#B3402A" stroke-width="5"/><path d="M38 18l8 8M46 18l-8 8" stroke="#B3402A" stroke-width="4" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "mustache",
    name: "Handlebar mustache",
    shelf: "prop",
    defaultSize: 240,
    svg: S(
      `<path d="M32 34c-4-6-10-7-15-4-5 3-9 1-11-2 2 8 10 12 17 9 4-1.6 7-1 9-3z" fill="#2C1D14"/><path d="M32 34c4-6 10-7 15-4 5 3 9 1 11-2-2 8-10 12-17 9-4-1.6-7-1-9-3z" fill="#2C1D14"/>`,
    ),
  },
  {
    id: "cactus",
    name: "Cactus",
    shelf: "prop",
    defaultSize: 200,
    svg: S(
      `<path d="M32 54V18c0-4 8-4 8 0v10" stroke="#7C8B6F" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M32 44H22c-4 0-4-8 0-8" stroke="#7C8B6F" stroke-width="9" stroke-linecap="round" fill="none"/>`,
    ),
  },
  {
    id: "bandana",
    name: "Bandana",
    shelf: "prop",
    defaultSize: 200,
    svg: S(
      `<path d="M12 28c8-14 32-14 40 0-6 4-12 6-20 6s-14-2-20-6z" fill="#B3402A"/><path d="M32 34v18l-6-4 6-4 6 4z" fill="#8A2E1C"/><path d="M18 30h28" stroke="#FAF3E3" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
    ),
  },
];

export function getParlorProp(id: string): ParlorPropDef | undefined {
  return PARLOR_PROPS.find((p) => p.id === id);
}

export function parlorPropSrc(def: ParlorPropDef): string {
  if (def.url) return def.url;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;
}

export function ParlorPropIcon({
  propId,
  className,
}: {
  propId: string;
  className?: string;
}): ReactNode {
  const def = getParlorProp(propId);
  if (!def) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={parlorPropSrc(def)}
      alt=""
      className={className}
      draggable={false}
    />
  );
}

export function costumesFromManifest() {
  return PARLOR_PROPS.filter((p) => p.shelf === "costume");
}

export function ranchPropsFromManifest() {
  return PARLOR_PROPS.filter((p) => p.shelf === "prop");
}
