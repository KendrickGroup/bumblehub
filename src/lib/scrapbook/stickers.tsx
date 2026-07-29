import type { ScrapbookStickerId } from "./types";

export const STICKERS: { id: ScrapbookStickerId; label: string }[] = [
  { id: "googly", label: "Googly eyes" },
  { id: "mustache", label: "Mustache" },
  { id: "cowboy-hat", label: "Cowboy hat" },
  { id: "sunglasses", label: "Sunglasses" },
  { id: "heart", label: "Heart" },
  { id: "star", label: "Star" },
  { id: "washi-a", label: "Washi A" },
  { id: "washi-b", label: "Washi B" },
  { id: "bandaid", label: "Bandaid" },
  { id: "arrow", label: "Arrow" },
  { id: "speech", label: "Speech" },
  { id: "banner", label: "Banner" },
  { id: "horseshoe", label: "Horseshoe" },
  { id: "bee", label: "Bee" },
  { id: "cactus", label: "Cactus" },
  { id: "boot", label: "Boot" },
];

export function StickerSvg({
  id,
  className,
}: {
  id: ScrapbookStickerId;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 64 64",
    className,
    "aria-hidden": true as const,
  };

  switch (id) {
    case "googly":
      return (
        <svg {...common}>
          <circle cx="20" cy="32" r="12" fill="#fff" stroke="#1a1a1a" strokeWidth="2" />
          <circle cx="44" cy="32" r="12" fill="#fff" stroke="#1a1a1a" strokeWidth="2" />
          <circle cx="23" cy="35" r="5" fill="#1a1a1a" />
          <circle cx="47" cy="35" r="5" fill="#1a1a1a" />
        </svg>
      );
    case "mustache":
      return (
        <svg {...common}>
          <path
            d="M8 36c6-10 14-8 18-2 1 2 3 2 4 0 4-6 12-8 18 2-8 2-14-2-18 4-1 1-3 1-4 0-4-6-10-2-18-4z"
            fill="#1a1a1a"
          />
        </svg>
      );
    case "cowboy-hat":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="42" rx="26" ry="7" fill="#8B5E3C" />
          <path d="M18 42v-12c0-8 6-14 14-14s14 6 14 14v12" fill="#A4724A" />
          <rect x="16" y="38" width="32" height="6" rx="2" fill="#F4B400" />
        </svg>
      );
    case "sunglasses":
      return (
        <svg {...common}>
          <rect x="6" y="24" width="22" height="16" rx="4" fill="#1a1a1a" />
          <rect x="36" y="24" width="22" height="16" rx="4" fill="#1a1a1a" />
          <path d="M28 30h8" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
          <path d="M6 28H2M62 28h-4" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path
            d="M32 52S8 36 8 22c0-8 6-14 14-14 5 0 8 3 10 6 2-3 5-6 10-6 8 0 14 6 14 14 0 14-24 30-24 30z"
            fill="#B3402A"
          />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path
            d="M32 6l6.5 18.5H58l-15 11 5.5 19L32 44l-16.5 10.5 5.5-19-15-11h19.5z"
            fill="#F4B400"
            stroke="#E0972B"
            strokeWidth="1"
          />
        </svg>
      );
    case "washi-a":
      return (
        <svg {...common}>
          <rect x="4" y="22" width="56" height="20" rx="2" fill="#FBF0D0" stroke="#E0972B" />
          <path d="M4 28h56M4 36h56" stroke="#F4B400" strokeWidth="3" />
        </svg>
      );
    case "washi-b":
      return (
        <svg {...common}>
          <rect x="4" y="22" width="56" height="20" rx="2" fill="#E8EEE4" stroke="#7C8B6F" />
          {[12, 24, 36, 48].map((x) => (
            <circle key={x} cx={x} cy="32" r="3" fill="#7C8B6F" />
          ))}
        </svg>
      );
    case "bandaid":
      return (
        <svg {...common}>
          <rect x="10" y="24" width="44" height="16" rx="8" fill="#F4B400" transform="rotate(-20 32 32)" />
          <rect x="26" y="26" width="12" height="12" rx="2" fill="#FAF8F3" transform="rotate(-20 32 32)" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path
            d="M8 32h40M36 18l16 14-16 14"
            fill="none"
            stroke="#3E5C76"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "speech":
      return (
        <svg {...common}>
          <rect x="8" y="10" width="48" height="34" rx="10" fill="#FAF8F3" stroke="#1a1a1a" strokeWidth="2" />
          <path d="M22 44l-6 12 14-10" fill="#FAF8F3" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "banner":
      return (
        <svg {...common}>
          <path d="M6 22h52l-6 12 6 12H6l6-12z" fill="#B3402A" />
          <path d="M12 22v24M52 22v24" stroke="#8B2E1C" strokeWidth="2" />
        </svg>
      );
    case "horseshoe":
      return (
        <svg {...common}>
          <path
            d="M16 48v-16c0-10 7-18 16-18s16 8 16 18v16"
            fill="none"
            stroke="#F4B400"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="16" cy="48" r="3" fill="#E0972B" />
          <circle cx="48" cy="48" r="3" fill="#E0972B" />
        </svg>
      );
    case "bee":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="34" rx="14" ry="16" fill="#F4B400" />
          <path d="M18 28h28M18 36h28M18 44h28" stroke="#1a1a1a" strokeWidth="3" />
          <circle cx="32" cy="16" r="8" fill="#1a1a1a" />
          <ellipse cx="18" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.85)" transform="rotate(-30 18 22)" />
          <ellipse cx="46" cy="22" rx="10" ry="6" fill="rgba(255,255,255,0.85)" transform="rotate(30 46 22)" />
        </svg>
      );
    case "cactus":
      return (
        <svg {...common}>
          <rect x="28" y="14" width="10" height="40" rx="5" fill="#7C8B6F" />
          <path d="M18 28v10c0 4 3 6 6 6h4" fill="none" stroke="#7C8B6F" strokeWidth="8" strokeLinecap="round" />
          <path d="M46 24v8c0 4-3 6-6 6h-2" fill="none" stroke="#7C8B6F" strokeWidth="8" strokeLinecap="round" />
        </svg>
      );
    case "boot":
      return (
        <svg {...common}>
          <path
            d="M22 8h14v28l16 6v10H14V36c0-8 8-10 8-28z"
            fill="#8B5E3C"
          />
          <rect x="14" y="48" width="38" height="8" rx="2" fill="#1a1a1a" />
          <path d="M26 20h10" stroke="#F4B400" strokeWidth="3" />
        </svg>
      );
  }
}

/** Default sticker size in canvas units. */
export function stickerDefaultSize(id: ScrapbookStickerId): {
  width: number;
  height: number;
} {
  if (id === "washi-a" || id === "washi-b") return { width: 280, height: 80 };
  if (id === "banner") return { width: 260, height: 100 };
  if (id === "speech") return { width: 200, height: 160 };
  return { width: 160, height: 160 };
}
