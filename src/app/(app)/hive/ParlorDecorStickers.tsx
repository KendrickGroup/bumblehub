import type { ReactNode } from "react";

/** Decorative costume / prop placeholders from the Snapshot Saloon mockup. */

export const COSTUME_STICKERS: { title: string; node: ReactNode }[] = [
  {
    title: "Prairie dress",
    node: (
      <svg viewBox="0 0 64 64" fill="none" stroke="#3E2A1E" strokeWidth="2.4" strokeLinejoin="round" className="h-full w-full" aria-hidden>
        <path d="M26 10h12l2 8-4 6h-8l-4-6z" />
        <path d="M28 24l-9 28c8 4 18 4 26 0l-9-28" />
        <path d="M22 42h20M24 47h16" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: "Vest & star",
    node: (
      <svg viewBox="0 0 64 64" fill="none" stroke="#3E2A1E" strokeWidth="2.4" strokeLinejoin="round" className="h-full w-full" aria-hidden>
        <path d="M22 12l-6 10 4 30h10l-2-24 4-10z" />
        <path d="M42 12l6 10-4 30H34l2-24-4-10z" />
        <path d="M23 34l1.2 2.8 3 .3-2.2 2 .6 3-2.6-1.6-2.6 1.6.6-3-2.2-2 3-.3z" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: "Gun belt & holster",
    node: (
      <svg viewBox="0 0 64 64" fill="none" stroke="#3E2A1E" strokeWidth="2.4" strokeLinejoin="round" className="h-full w-full" aria-hidden>
        <path d="M10 24h44v8H10z" />
        <path d="M40 32v6c0 8 4 10 4 14l6-2c2-6-2-10-2-18" />
        <circle cx="20" cy="28" r="1.4" />
        <circle cx="28" cy="28" r="1.4" />
        <circle cx="36" cy="28" r="1.4" />
      </svg>
    ),
  },
  {
    title: "Duster coat",
    node: (
      <svg viewBox="0 0 64 64" fill="none" stroke="#3E2A1E" strokeWidth="2.4" strokeLinejoin="round" className="h-full w-full" aria-hidden>
        <path d="M24 12h16l6 8-4 34h-6l-4-26-4 26h-6l-4-34z" />
        <path d="M24 12l8 8 8-8" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: "Cowboy hat",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <path d="M14 38c0-4 6-16 18-16s18 12 18 16" fill="#3E2A1E" />
        <ellipse cx="32" cy="40" rx="26" ry="7" fill="#3E2A1E" />
        <path d="M20 37h24" stroke="#F4B400" strokeWidth="4" />
      </svg>
    ),
  },
];

export const PROP_STICKERS: { title: string; node: ReactNode }[] = [
  {
    title: "Sheriff badge",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <path
          d="M32 8l6 8 10-2-2 10 8 6-8 6 2 10-10-2-6 8-6-8-10 2 2-10-8-6 8-6-2-10 10 2z"
          fill="#F4B400"
          stroke="#B8860B"
          strokeWidth="2"
        />
        <circle cx="32" cy="32" r="9" fill="#FAF3E3" />
      </svg>
    ),
  },
  {
    title: "Horseshoe",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <path
          d="M18 46V30c0-9 6-16 14-16s14 7 14 16v16"
          fill="none"
          stroke="#5C4430"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="18" cy="46" r="3" fill="#F4B400" />
        <circle cx="46" cy="46" r="3" fill="#F4B400" />
      </svg>
    ),
  },
  {
    title: "Lasso",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <circle cx="36" cy="26" r="14" fill="none" stroke="#8A5A2B" strokeWidth="5" />
        <path
          d="M26 37c-8 6-12 12-10 18"
          fill="none"
          stroke="#8A5A2B"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Branding iron",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <path d="M12 52L34 30" stroke="#5C4430" strokeWidth="6" strokeLinecap="round" />
        <rect x="32" y="12" width="20" height="20" rx="4" fill="none" stroke="#B3402A" strokeWidth="5" />
        <path d="M38 18l8 8M46 18l-8 8" stroke="#B3402A" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Handlebar mustache",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <path
          d="M32 34c-4-6-10-7-15-4-5 3-9 1-11-2 2 8 10 12 17 9 4-1.6 7-1 9-3z"
          fill="#2C1D14"
        />
        <path
          d="M32 34c4-6 10-7 15-4 5 3 9 1 11-2-2 8-10 12-17 9-4-1.6-7-1-9-3z"
          fill="#2C1D14"
        />
      </svg>
    ),
  },
  {
    title: "Cactus",
    node: (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <path
          d="M32 54V18c0-4 8-4 8 0v10"
          stroke="#7C8B6F"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M32 44H22c-4 0-4-8 0-8"
          stroke="#7C8B6F"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
];
