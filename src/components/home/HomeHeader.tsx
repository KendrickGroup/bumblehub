"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { AppBrandLockup } from "@/components/brand/AppBrandLockup";
import { WeatherButton } from "@/components/home/WeatherButton";
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

export function HomeHeader({
  propertyName,
  houseGreeting,
  firstName,
  timezone,
}: Props) {
  const [houseMode, setHouseMode] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      setHouseMode(isHouseModeDevice());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hour = now ? hourInTimezone(now, timezone) : new Date().getHours();
  const title = houseMode
    ? resolveHouseGreeting(houseGreeting, propertyName ?? "home", hour)
    : personalGreeting(firstName, hour);

  const time = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now)
    : "";
  const date = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(now)
    : "";

  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <AppBrandLockup markSize={26} />
        <h1
          className="mt-1 font-[family-name:var(--font-fraunces)] text-[26px] font-extrabold leading-tight text-[#241A12]"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          {title}
        </h1>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-3">
          {now ? (
            <>
              <span className="text-[40px] font-extrabold leading-none tabular-nums text-[#241A12]">
                {time}
              </span>
              <span className="text-[12px] text-[#8A7F6E]">{date}</span>
            </>
          ) : (
            <span className="h-10 w-40 animate-pulse rounded-lg bg-stone-200/60" />
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <WeatherButton />
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings — PIN required"
          className="mt-1.5 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F0EDE6] text-[#241A12] shadow-[0_2px_6px_rgba(60,50,35,.1)]"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </header>
  );
}
