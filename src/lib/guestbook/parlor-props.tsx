import type { ReactNode } from "react";

/** Swap art by changing `url` (or `svg`) — ids stay stable. */
export type ParlorPropDef = {
  id: string;
  name: string;
  shelf: "costume" | "face" | "prop";
  /** Public path under /parlor-props (preferred). */
  url?: string;
  /** Inline SVG fallback when url is unset. */
  svg?: string;
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

const asset = (file: string) => `/parlor-props/${file}`;

export const PARLOR_PROPS: ParlorPropDef[] = [
  // —— Costume rack ——
  {
    id: "hat-cattleman",
    name: "Cattleman hat",
    shelf: "costume",
    url: asset("01-hat-cattleman.png"),
    defaultSize: 340,
  },
  {
    id: "hat-ten-gallon",
    name: "Ten-gallon hat",
    shelf: "costume",
    url: asset("02-hat-ten-gallon.png"),
    defaultSize: 360,
  },
  {
    id: "hat-gambler",
    name: "Gambler hat",
    shelf: "costume",
    url: asset("03-hat-gambler.png"),
    defaultSize: 340,
  },
  {
    id: "dress-prairie",
    name: "Prairie dress",
    shelf: "costume",
    url: asset("04-dress-prairie.png"),
    defaultSize: 380,
  },
  {
    id: "dress-saloon",
    name: "Saloon dress",
    shelf: "costume",
    url: asset("05-dress-saloon.png"),
    defaultSize: 380,
  },
  {
    id: "vest",
    name: "Ranch vest",
    shelf: "costume",
    url: asset("06-vest-ranch.png"),
    defaultSize: 300,
  },
  {
    id: "duster",
    name: "Duster coat",
    shelf: "costume",
    url: asset("07-duster.png"),
    defaultSize: 400,
  },
  {
    id: "gun-belt",
    name: "Gun belt",
    shelf: "costume",
    url: asset("08-gun-belt.png"),
    defaultSize: 360,
  },
  {
    id: "bandana",
    name: "Bandana",
    shelf: "costume",
    url: asset("09-bandana.png"),
    defaultSize: 260,
  },
  {
    id: "boots",
    name: "Cowboy boots",
    shelf: "costume",
    url: asset("10-boots.png"),
    defaultSize: 300,
  },
  {
    id: "spurs",
    name: "Spurs",
    shelf: "costume",
    url: asset("11-spurs.png"),
    defaultSize: 240,
  },

  // —— Faces ——
  {
    id: "mustache-handlebar",
    name: "Handlebar mustache",
    shelf: "face",
    url: asset("12-mustache-handlebar.png"),
    defaultSize: 280,
  },
  {
    id: "mustache-walrus",
    name: "Walrus mustache",
    shelf: "face",
    url: asset("13-mustache-walrus.png"),
    defaultSize: 280,
  },
  {
    id: "mustache-horseshoe",
    name: "Horseshoe mustache",
    shelf: "face",
    url: asset("14-mustache-horseshoe.png"),
    defaultSize: 260,
  },
  {
    id: "beard-full",
    name: "Frontier beard",
    shelf: "face",
    url: asset("15-beard-full.png"),
    defaultSize: 300,
  },
  {
    id: "goatee",
    name: "Goatee",
    shelf: "face",
    url: asset("16-goatee.png"),
    defaultSize: 240,
  },
  {
    id: "muttonchops",
    name: "Muttonchops",
    shelf: "face",
    url: asset("17-muttonchops.png"),
    defaultSize: 300,
  },
  {
    id: "spectacles-wire",
    name: "Wire spectacles",
    shelf: "face",
    url: asset("18-spectacles-wire.png"),
    defaultSize: 220,
  },
  {
    id: "pince-nez",
    name: "Pince-nez",
    shelf: "face",
    url: asset("19-pince-nez.png"),
    defaultSize: 220,
  },
  {
    id: "monocle",
    name: "Monocle",
    shelf: "face",
    url: asset("20-monocle.png"),
    defaultSize: 180,
  },

  // —— Ranch props ——
  {
    id: "horseshoe",
    name: "Horseshoe",
    shelf: "prop",
    url: asset("21-horseshoe.png"),
    defaultSize: 200,
  },
  {
    id: "lasso",
    name: "Lasso",
    shelf: "prop",
    url: asset("22-lasso.png"),
    defaultSize: 280,
  },
  {
    id: "branding-iron",
    name: "Branding iron",
    shelf: "prop",
    url: asset("23-branding-iron.png"),
    defaultSize: 300,
  },
  {
    id: "badge",
    name: "Sheriff badge",
    shelf: "prop",
    url: asset("24-badge.png"),
    defaultSize: 160,
  },
  {
    id: "revolver",
    name: "Revolver",
    shelf: "prop",
    url: asset("25-revolver.png"),
    defaultSize: 260,
  },
  {
    id: "frame",
    name: "Wanted frame",
    shelf: "prop",
    url: asset("26-frame.png"),
    defaultSize: 320,
  },
  {
    id: "whiskey",
    name: "Whiskey & glass",
    shelf: "prop",
    url: asset("27-whiskey.png"),
    defaultSize: 240,
  },
  {
    id: "pocket-watch",
    name: "Pocket watch",
    shelf: "prop",
    url: asset("28-pocket-watch.png"),
    defaultSize: 200,
  },
  {
    id: "cards",
    name: "Aces & eights",
    shelf: "prop",
    url: asset("29-cards.png"),
    defaultSize: 240,
  },
  {
    id: "signpost",
    name: "Signpost",
    shelf: "prop",
    url: asset("30-signpost.png"),
    defaultSize: 280,
  },
  {
    id: "cactus",
    name: "Saguaro",
    shelf: "prop",
    url: asset("31-cactus.png"),
    defaultSize: 280,
  },
  {
    id: "sun",
    name: "Blazing sun",
    shelf: "prop",
    url: asset("32-sun.png"),
    defaultSize: 260,
  },
];

export function getParlorProp(id: string): ParlorPropDef | undefined {
  return PARLOR_PROPS.find((p) => p.id === id);
}

export function parlorPropSrc(def: ParlorPropDef): string {
  if (def.url) return def.url;
  if (def.svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;
  }
  return "";
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
  const src = parlorPropSrc(def);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} draggable={false} />
  );
}

export function costumesFromManifest() {
  return PARLOR_PROPS.filter((p) => p.shelf === "costume");
}

export function facesFromManifest() {
  return PARLOR_PROPS.filter((p) => p.shelf === "face");
}

export function ranchPropsFromManifest() {
  return PARLOR_PROPS.filter((p) => p.shelf === "prop");
}
