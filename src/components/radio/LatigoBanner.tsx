"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BANNER_DEFAULT_LINE,
  BANNER_FADE_MS,
  BANNER_HREF,
  BANNER_ROTATE_MS,
  BANNER_TITLE,
  BANNER_TITLE_LEFT,
  BANNER_TITLE_RIGHT,
} from "@/lib/radio/banner";

type Placement = "left" | "center" | "right";

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}

function pickPlacement(last: Placement | null, allowCenter: boolean): Placement {
  const pool: Placement[] = allowCenter
    ? ["left", "center", "right"]
    : ["left", "right"];
  if (pool.length === 1) return pool[0]!;
  let next: Placement = pool[0]!;
  do {
    next = pool[Math.floor(Math.random() * pool.length)]!;
  } while (next === last);
  return next;
}

function pickLine(last: string, lines: string[]): string {
  const pool = lines.length > 0 ? lines : [BANNER_DEFAULT_LINE];
  if (pool.length === 1) return pool[0]!;
  let next = pool[0]!;
  do {
    next = pool[Math.floor(Math.random() * pool.length)]!;
  } while (next === last);
  return next;
}

function BannerThumb({ src }: { src: string | null }) {
  if (!src) {
    return <span className="radio-banner-concho" aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="radio-banner-thumb" />
  );
}

function BannerCopy({
  placement,
  line,
  src,
}: {
  placement: Placement;
  line: string;
  src: string | null;
}) {
  if (placement === "center") {
    return (
      <>
        <span className="radio-banner-half l">{BANNER_TITLE_LEFT}</span>
        <BannerThumb src={src} />
        <span className="radio-banner-half r">{BANNER_TITLE_RIGHT}</span>
      </>
    );
  }
  return (
    <>
      {placement === "left" ? <BannerThumb src={src} /> : null}
      <div className="radio-banner-txt">
        <div className="radio-banner-l1">{BANNER_TITLE}</div>
        <div className="radio-banner-l2">{line}</div>
      </div>
      {placement === "right" ? <BannerThumb src={src} /> : null}
    </>
  );
}

export function LatigoBanner({
  images,
  lines,
  link,
  children,
}: {
  images: string[];
  lines: string[];
  link: boolean;
  children: ReactNode;
}) {
  const [order, setOrder] = useState<string[]>(images);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement>("left");
  const [line, setLine] = useState(BANNER_DEFAULT_LINE);
  const [fading, setFading] = useState(false);
  const placementRef = useRef<Placement>("left");
  const lineRef = useRef(BANNER_DEFAULT_LINE);
  const indexRef = useRef(0);
  const orderRef = useRef(order);
  const linesRef = useRef(lines);
  const allowCenterRef = useRef(true);
  const fadingLock = useRef(false);
  const imageKey = images.join("\n");

  linesRef.current = lines;

  useEffect(() => {
    const next = shuffle(imageKey ? imageKey.split("\n") : []);
    setOrder(next);
    setIndex(0);
    orderRef.current = next;
    indexRef.current = 0;
  }, [imageKey]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 419px)");
    const sync = () => {
      const ok = !mq.matches;
      allowCenterRef.current = ok;
      if (!ok && placementRef.current === "center") {
        const nextPlace = pickPlacement("center", false);
        placementRef.current = nextPlace;
        setPlacement(nextPlace);
      }
    };
    sync();
    const nextPlace = pickPlacement(null, !mq.matches);
    const nextLine = pickLine("", linesRef.current);
    placementRef.current = nextPlace;
    lineRef.current = nextLine;
    setPlacement(nextPlace);
    setLine(nextLine);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let fadeTimer: number | undefined;
    const tick = () => {
      if (fadingLock.current) return;
      fadingLock.current = true;
      setFading(true);
      fadeTimer = window.setTimeout(() => {
        const nextPlace = pickPlacement(
          placementRef.current,
          allowCenterRef.current,
        );
        const nextLine = pickLine(lineRef.current, linesRef.current);
        const list = orderRef.current;
        const nextIndex =
          list.length > 0 ? (indexRef.current + 1) % list.length : 0;
        placementRef.current = nextPlace;
        lineRef.current = nextLine;
        indexRef.current = nextIndex;
        setPlacement(nextPlace);
        setLine(nextLine);
        setIndex(nextIndex);
        setFading(false);
        fadingLock.current = false;
      }, BANNER_FADE_MS);
    };
    const id = window.setInterval(tick, BANNER_ROTATE_MS);
    return () => {
      window.clearInterval(id);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, []);

  const src = order[index] ?? null;
  const stageClass = `radio-banner-stage is-${placement}${fading ? " is-fading" : ""}`;
  const inner = (
    <BannerCopy placement={placement} line={line} src={src} />
  );

  return (
    <div className="radio-banner">
      {link ? (
        <a
          className={stageClass}
          href={BANNER_HREF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Latigo Cowboy Authentics"
        >
          {inner}
        </a>
      ) : (
        <div className={stageClass}>{inner}</div>
      )}
      {children}
    </div>
  );
}
