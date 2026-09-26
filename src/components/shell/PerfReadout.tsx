"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Marks = {
  html: number | null;
  js: number | null;
  paint: number | null;
  auth: number | null;
  interactive: number | null;
};

function ms(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "…";
  return `${Math.round(value)} ms`;
}

/**
 * Visible only with ?perf=1. Times are from navigation start.
 * Auth is the background session check, not a gate in front of paint.
 */
export function PerfReadout() {
  const [marks, setMarks] = useState<Marks | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return;

    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const next: Marks = {
      html: nav ? nav.responseEnd : null,
      js: performance.now(),
      paint: null,
      auth: null,
      interactive: nav ? nav.domInteractive : null,
    };
    setMarks(next);

    const readPaint = () => {
      const paint = performance.getEntriesByName("first-contentful-paint")[0];
      if (!paint) return;
      next.paint = paint.startTime;
      setMarks({ ...next });
    };
    readPaint();
    const observer = new PerformanceObserver(readPaint);
    try {
      observer.observe({ type: "paint", buffered: true });
    } catch {
      // Older WebKit.
    }

    const supabase = createClient();
    void supabase.auth.getUser().then(
      () => {
        next.auth = performance.now();
        setMarks({ ...next });
      },
      () => {
        next.auth = performance.now();
        setMarks({ ...next });
      },
    );

    return () => observer.disconnect();
  }, []);

  if (!marks) return null;

  return (
    <aside
      className="pointer-events-none fixed bottom-3 left-3 z-[80] max-w-[220px] rounded-xl bg-[#FAF8F3]/95 px-3 py-2 font-mono text-[11px] leading-5 text-stone-700 shadow-sm"
      aria-label="Launch timings"
    >
      <p>HTML received {ms(marks.html)}</p>
      <p>JS executed {ms(marks.js)}</p>
      <p>First paint {ms(marks.paint)}</p>
      <p>Auth complete {ms(marks.auth)}</p>
      <p>Interactive {ms(marks.interactive)}</p>
    </aside>
  );
}
