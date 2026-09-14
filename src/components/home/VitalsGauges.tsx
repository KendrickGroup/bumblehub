"use client";

import { VITAL_SLOT_LABEL, type VitalsConfig } from "@/lib/home/vitals";
import { updatedLabel, useVitalsReadings } from "./useVitalsReadings";

export function VitalsGauges({ config }: { config: VitalsConfig }) {
  const snapshot = useVitalsReadings(config);

  if (snapshot.status === "empty") {
    return (
      <p className="rounded-[20px] border border-dashed border-stone-200 bg-white px-5 py-10 text-center text-stone-500">
        Connect sensors in Settings to watch water, battery, and solar.
      </p>
    );
  }

  if (snapshot.status === "loading") {
    return (
      <p className="rounded-[20px] bg-white px-5 py-10 text-center text-stone-500 shadow-sm">
        Reading the house…
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {snapshot.readings.map((reading) => (
        <article
          key={reading.slot}
          className="rounded-[20px] bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#A08A5F]">
            {VITAL_SLOT_LABEL[reading.slot]}
          </p>
          <p className="mt-3 text-5xl font-extrabold tabular-nums text-[#241A12]">
            {reading.display}
          </p>
          <p className="mt-1 text-sm text-stone-500">{reading.name}</p>
          {reading.percent != null ? (
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#EFE7D2]">
              <div
                className="h-full rounded-full bg-[#F4B400]"
                style={{ width: `${reading.percent}%` }}
              />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-[#8A7F6E]">
            {reading.unreachable ? "Home Assistant unreachable" : updatedLabel(reading)}
          </p>
        </article>
      ))}
    </div>
  );
}
