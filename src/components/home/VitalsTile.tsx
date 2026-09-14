"use client";

import Link from "next/link";
import { VITAL_SLOT_LABEL, type VitalsConfig } from "@/lib/home/vitals";
import { useVitalsReadings } from "./useVitalsReadings";

export function VitalsTile({ config }: { config: VitalsConfig }) {
  const snapshot = useVitalsReadings(config);

  return (
    <Link
      href="/vitals"
      className="tile-card tile-vitals col-span-1 min-h-[76px] max-[479px]:col-span-1"
    >
      <span className="tile-ic bg-white">🔋</span>
      <span className="min-w-0 flex-1">
        <span className="tile-title">Vitals</span>
        {snapshot.status === "empty" ? (
          <span className="mt-1 block text-[11px] leading-snug text-[#8A7F6E]">
            Connect sensors in Settings
          </span>
        ) : snapshot.status === "loading" ? (
          <span className="mt-1 block text-[11px] text-[#8A7F6E]">Reading…</span>
        ) : (
          <span className="mt-1 flex flex-wrap gap-2.5">
            {snapshot.readings.map((reading) => (
              <span key={reading.slot} className="text-[10.5px] text-[#8A7F6E]">
                <b className="text-[12px] font-extrabold text-[#241A12]">
                  {reading.display}
                </b>{" "}
                {VITAL_SLOT_LABEL[reading.slot].split(" ")[0].toLowerCase()}
              </span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}
