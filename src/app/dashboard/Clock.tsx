"use client";

import { useEffect, useState } from "react";

export function Clock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="h-[4.5rem] w-48 animate-pulse rounded-2xl bg-stone-200/60" />
    );
  }

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <div>
      <p className="text-6xl font-semibold tracking-tight text-stone-900 sm:text-7xl">
        {time}
      </p>
      <p className="mt-1 text-lg text-stone-500">{date}</p>
    </div>
  );
}
