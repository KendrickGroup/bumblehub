"use client";

import { fitStateShape, STATE_SHAPES } from "@/lib/stateShapes";
import {
  RANCH_LAT,
  RANCH_LON,
  US_STATE_NAMES,
} from "@/lib/radio/ranch";

const VIEW_W = 240;
const VIEW_H = 200;

function Beacon({
  x,
  y,
  label,
  sub,
}: {
  x: number;
  y: number;
  label: string;
  sub?: string | null;
}) {
  const flip = x > 140;
  return (
    <g>
      <circle className="radio-beacon-glow" cx={x} cy={y} r={7} fill="#F4B400" />
      <circle
        cx={x}
        cy={y}
        r={4.5}
        fill="#D64530"
        stroke="#111"
        strokeWidth={0.8}
      />
      <text
        x={flip ? x - 9 : x + 9}
        y={y + 4}
        textAnchor={flip ? "end" : "start"}
        className="radio-citylabel"
      >
        {label.toUpperCase()}
      </text>
      {sub ? (
        <text
          x={flip ? x - 9 : x + 9}
          y={y + 16}
          textAnchor={flip ? "end" : "start"}
          className="radio-citylabel"
        >
          {sub.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
}

function BaseballDiamond() {
  return (
    <g>
      <path
        d="M 40 170 A 85 85 0 0 1 200 170"
        fill="#EFE7D2"
        stroke="#5A4632"
        strokeWidth="2.5"
      />
      <polygon
        points="120,165 75,120 120,75 165,120"
        fill="#F6F1E6"
        stroke="#5A4632"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {[
        [120, 165],
        [75, 120],
        [120, 75],
        [165, 120],
      ].map(([bx, by]) => (
        <rect
          key={`${bx}-${by}`}
          x={bx - 4}
          y={by - 4}
          width={8}
          height={8}
          fill="#D64530"
          stroke="#5A4632"
          strokeWidth={1}
          transform={`rotate(45 ${bx} ${by})`}
        />
      ))}
      <circle
        cx={120}
        cy={120}
        r={7}
        fill="#EFE7D2"
        stroke="#5A4632"
        strokeWidth={1.5}
      />
      <text x={120} y={188} textAnchor="middle" className="radio-citylabel">
        THE OLD BALL GAME
      </text>
    </g>
  );
}

export function StationChart({
  mode,
  stateCode,
  lon,
  lat,
  cityLabel,
  citySub,
}: {
  mode: "station" | "wx" | "sports";
  stateCode: string | null;
  lon: number | null;
  lat: number | null;
  cityLabel: string;
  citySub?: string | null;
}) {
  if (mode === "sports") {
    return (
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="radio-chart-svg">
        <BaseballDiamond />
      </svg>
    );
  }

  const key = mode === "wx" ? "CA" : stateCode?.toUpperCase() ?? "";
  const pts = STATE_SHAPES[key];
  const marker =
    mode === "wx"
      ? { lon: RANCH_LON, lat: RANCH_LAT }
      : lon != null && lat != null
        ? { lon, lat }
        : null;
  const label = mode === "wx" ? "The Ranch" : cityLabel;
  const sub = mode === "wx" ? citySub || "Sutter Creek" : citySub;

  if (!pts) {
    return (
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="radio-chart-svg">
        <Beacon
          x={VIEW_W / 2}
          y={VIEW_H / 2}
          label={label || "—"}
          sub={sub}
        />
      </svg>
    );
  }

  const fitted = fitStateShape(pts, VIEW_W, VIEW_H, 16);
  const m = marker ? fitted.project(marker.lon, marker.lat) : null;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="radio-chart-svg">
      <polygon className="radio-stateshape" points={fitted.points} />
      {m ? <Beacon x={m.x} y={m.y} label={label} sub={sub} /> : null}
    </svg>
  );
}

export function chartTitle(
  mode: "station" | "wx" | "sports",
  stateCode: string | null,
): string {
  if (mode === "wx") return "Weather Chart — California";
  if (mode === "sports") return "Field Chart — Classic Baseball";
  const name = stateCode ? US_STATE_NAMES[stateCode.toUpperCase()] : null;
  return name ? `Station Chart — ${name}` : "Station Chart";
}
