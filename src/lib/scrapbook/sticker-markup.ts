import type { ScrapbookStickerId } from "./types";

/** Inline SVG markups for canvas flatten (no React). */
export function stickerSvgMarkup(id: ScrapbookStickerId): string {
  const body = (() => {
    switch (id) {
      case "googly":
        return `<circle cx="20" cy="32" r="12" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><circle cx="44" cy="32" r="12" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><circle cx="23" cy="35" r="5" fill="#1a1a1a"/><circle cx="47" cy="35" r="5" fill="#1a1a1a"/>`;
      case "mustache":
        return `<path d="M8 36c6-10 14-8 18-2 1 2 3 2 4 0 4-6 12-8 18 2-8 2-14-2-18 4-1 1-3 1-4 0-4-6-10-2-18-4z" fill="#1a1a1a"/>`;
      case "cowboy-hat":
        return `<ellipse cx="32" cy="42" rx="26" ry="7" fill="#8B5E3C"/><path d="M18 42v-12c0-8 6-14 14-14s14 6 14 14v12" fill="#A4724A"/><rect x="16" y="38" width="32" height="6" rx="2" fill="#F4B400"/>`;
      case "sunglasses":
        return `<rect x="6" y="24" width="22" height="16" rx="4" fill="#1a1a1a"/><rect x="36" y="24" width="22" height="16" rx="4" fill="#1a1a1a"/><path d="M28 30h8" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/><path d="M6 28H2M62 28h-4" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>`;
      case "heart":
        return `<path d="M32 52S8 36 8 22c0-8 6-14 14-14 5 0 8 3 10 6 2-3 5-6 10-6 8 0 14 6 14 14 0 14-24 30-24 30z" fill="#B3402A"/>`;
      case "star":
        return `<path d="M32 6l6.5 18.5H58l-15 11 5.5 19L32 44l-16.5 10.5 5.5-19-15-11h19.5z" fill="#F4B400" stroke="#E0972B"/>`;
      case "washi-a":
        return `<rect x="4" y="22" width="56" height="20" rx="2" fill="#FBF0D0" stroke="#E0972B"/><path d="M4 28h56M4 36h56" stroke="#F4B400" stroke-width="3"/>`;
      case "washi-b":
        return `<rect x="4" y="22" width="56" height="20" rx="2" fill="#E8EEE4" stroke="#7C8B6F"/><circle cx="12" cy="32" r="3" fill="#7C8B6F"/><circle cx="24" cy="32" r="3" fill="#7C8B6F"/><circle cx="36" cy="32" r="3" fill="#7C8B6F"/><circle cx="48" cy="32" r="3" fill="#7C8B6F"/>`;
      case "bandaid":
        return `<g transform="rotate(-20 32 32)"><rect x="10" y="24" width="44" height="16" rx="8" fill="#F4B400"/><rect x="26" y="26" width="12" height="12" rx="2" fill="#FAF8F3"/></g>`;
      case "arrow":
        return `<path d="M8 32h40M36 18l16 14-16 14" fill="none" stroke="#3E5C76" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
      case "speech":
        return `<rect x="8" y="10" width="48" height="34" rx="10" fill="#FAF8F3" stroke="#1a1a1a" stroke-width="2"/><path d="M22 44l-6 12 14-10" fill="#FAF8F3" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round"/>`;
      case "banner":
        return `<path d="M6 22h52l-6 12 6 12H6l6-12z" fill="#B3402A"/><path d="M12 22v24M52 22v24" stroke="#8B2E1C" stroke-width="2"/>`;
      case "horseshoe":
        return `<path d="M16 48v-16c0-10 7-18 16-18s16 8 16 18v16" fill="none" stroke="#F4B400" stroke-width="8" stroke-linecap="round"/><circle cx="16" cy="48" r="3" fill="#E0972B"/><circle cx="48" cy="48" r="3" fill="#E0972B"/>`;
      case "bee":
        return `<ellipse cx="32" cy="34" rx="14" ry="16" fill="#F4B400"/><path d="M18 28h28M18 36h28M18 44h28" stroke="#1a1a1a" stroke-width="3"/><circle cx="32" cy="16" r="8" fill="#1a1a1a"/><ellipse cx="18" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.85)" transform="rotate(-30 18 22)"/><ellipse cx="46" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.85)" transform="rotate(30 46 22)"/>`;
      case "cactus":
        return `<rect x="28" y="14" width="10" height="40" rx="5" fill="#7C8B6F"/><path d="M18 28v10c0 4 3 6 6 6h4" fill="none" stroke="#7C8B6F" stroke-width="8" stroke-linecap="round"/><path d="M46 24v8c0 4-3 6-6 6h-2" fill="none" stroke="#7C8B6F" stroke-width="8" stroke-linecap="round"/>`;
      case "boot":
        return `<path d="M22 8h14v28l16 6v10H14V36c0-8 8-10 8-28z" fill="#8B5E3C"/><rect x="14" y="48" width="38" height="8" rx="2" fill="#1a1a1a"/><path d="M26 20h10" stroke="#F4B400" stroke-width="3"/>`;
    }
  })();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">${body}</svg>`;
}

const cache = new Map<string, HTMLImageElement>();

export async function loadStickerImage(
  id: ScrapbookStickerId,
): Promise<HTMLImageElement> {
  const hit = cache.get(id);
  if (hit) return hit;
  const url =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(stickerSvgMarkup(id));
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("sticker"));
    el.src = url;
  });
  cache.set(id, img);
  return img;
}
