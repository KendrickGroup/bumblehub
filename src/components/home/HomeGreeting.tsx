"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  hourInTimezone,
  isHouseModeDevice,
  personalGreeting,
  resolveHouseGreeting,
} from "@/lib/house-mode/settings";

type Props = {
  propertyName: string | null;
  houseGreeting: string;
  firstName: string | null;
  timezone: string;
};

export function HomeGreeting({
  propertyName,
  houseGreeting,
  firstName,
  timezone,
}: Props) {
  const [houseMode, setHouseMode] = useState(false);
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    setHouseMode(isHouseModeDevice());
    const tick = () => {
      setHour(hourInTimezone(new Date(), timezone));
      setHouseMode(isHouseModeDevice());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [timezone]);

  const title = houseMode
    ? resolveHouseGreeting(
        houseGreeting,
        propertyName ?? "home",
        hour,
      )
    : personalGreeting(firstName, hour);

  return (
    <>
      <BrandMark beeHeight={28} wordmarkHeight={18} />
      <h1
        className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900 sm:text-4xl"
        style={{ fontVariationSettings: '"opsz" 72' }}
      >
        {title}
      </h1>
    </>
  );
}
