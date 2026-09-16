import type { JSX, ReactNode } from "react";

const UMBER = "#5A4632";
const NEEDLE = "#D64530";

function FlagFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 40 26"
      width="22"
      height="14"
      aria-hidden
      className="radio-stateflag"
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="24"
        rx="2"
        fill="none"
        stroke={UMBER}
        strokeWidth="1.6"
      />
      {children}
    </svg>
  );
}

function TnFlag() {
  return (
    <FlagFrame>
      <rect x="33" y="1" width="6" height="24" fill={UMBER} opacity=".3" />
      <circle cx="17" cy="13" r="8.5" fill="none" stroke={NEEDLE} strokeWidth="1.6" />
      <g fill={UMBER}>
        <path d="M17 7.4 l1.1 2.3 2.5.3 -1.9 1.7 .6 2.5 -2.3-1.3 -2.3 1.3 .6-2.5 -1.9-1.7 2.5-.3z" />
        <circle cx="13.4" cy="15.6" r="1.5" />
        <circle cx="20.6" cy="15.6" r="1.5" />
      </g>
    </FlagFrame>
  );
}

function TxFlag() {
  return (
    <FlagFrame>
      <rect x="1" y="1" width="12" height="24" fill={UMBER} opacity=".28" />
      <path
        d="M7 8.2 l1.05 2.15 2.35.28 -1.8 1.6 .55 2.3 -2.15-1.2 -2.15 1.2 .55-2.3 -1.8-1.6 2.35-.28z"
        fill={NEEDLE}
      />
      <line x1="13" y1="13" x2="39" y2="13" stroke={NEEDLE} strokeWidth="1.4" />
    </FlagFrame>
  );
}

function FlFlag() {
  return (
    <FlagFrame>
      <path
        d="M3 3 L37 23 M37 3 L3 23"
        fill="none"
        stroke={NEEDLE}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="20" cy="13" r="5.2" fill="none" stroke={UMBER} strokeWidth="1.5" />
    </FlagFrame>
  );
}

function PaFlag() {
  return (
    <FlagFrame>
      <path
        d="M14 5.5 H26 V14.5 L20 21.5 L14 14.5 Z"
        fill="none"
        stroke={UMBER}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 8.2 l.85 1.7 1.85.22 -1.4 1.25 .42 1.8 -1.72-.95 -1.72.95 .42-1.8 -1.4-1.25 1.85-.22z"
        fill={NEEDLE}
      />
    </FlagFrame>
  );
}

function ArFlag() {
  return (
    <FlagFrame>
      <path
        d="M20 4.5 L33 13 L20 21.5 L7 13 Z"
        fill="none"
        stroke={UMBER}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 8.6 l.9 1.8 2 .24 -1.5 1.35 .45 1.9 -1.85-1.05 -1.85 1.05 .45-1.9 -1.5-1.35 2-.24z"
        fill={NEEDLE}
      />
    </FlagFrame>
  );
}

function CaFlag() {
  return (
    <FlagFrame>
      <path
        d="M7 7.2 l.8 1.6 1.75.2 -1.35 1.2 .4 1.7 -1.6-.9 -1.6.9 .4-1.7 -1.35-1.2 1.75-.2z"
        fill={NEEDLE}
      />
      <path
        d="M11 17.5 c2.2-3.4 5.4-4.6 9.2-4.2 c2.2.2 3.6-.6 4.6-1.8 c.2 1.6-.2 2.8-1.1 3.6 c1.6.2 2.6.9 3 1.8 H13.2 Z"
        fill="none"
        stroke={UMBER}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line
        x1="4"
        y1="21"
        x2="36"
        y2="21"
        stroke={NEEDLE}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </FlagFrame>
  );
}

const FLAGS: Record<string, () => JSX.Element> = {
  TN: TnFlag,
  TX: TxFlag,
  FL: FlFlag,
  PA: PaFlag,
  AR: ArFlag,
  CA: CaFlag,
};

export function StateFlagIcon({
  code,
}: {
  code: string | null | undefined;
}) {
  const key = code?.trim().toUpperCase() ?? "";
  const Flag = FLAGS[key];
  if (!Flag) return null;
  return <Flag />;
}
