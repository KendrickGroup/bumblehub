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
} from "@/lib/radio/banner";

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

function pickLine(last: string, lines: string[]): string {
  const pool = lines.length > 0 ? lines : [BANNER_DEFAULT_LINE];
  if (pool.length === 1) return pool[0]!;
  let next = pool[0]!;
  do {
    next = pool[Math.floor(Math.random() * pool.length)]!;
  } while (next === last);
  return next;
}

function BannerShot({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className="radio-banner-shot" aria-hidden>
        <span className="radio-banner-concho" />
      </span>
    );
  }

  return (
    <span className="radio-banner-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={800}
        height={800}
        sizes="108px"
        srcSet={`${src} 800w`}
        className="radio-banner-thumb"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
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
  const [line, setLine] = useState(BANNER_DEFAULT_LINE);
  const [fading, setFading] = useState(false);
  const lineRef = useRef(BANNER_DEFAULT_LINE);
  const indexRef = useRef(0);
  const orderRef = useRef(order);
  const linesRef = useRef(lines);
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
    const nextLine = pickLine("", linesRef.current);
    lineRef.current = nextLine;
    setLine(nextLine);
  }, []);

  useEffect(() => {
    let fadeTimer: number | undefined;
    const tick = () => {
      if (fadingLock.current) return;
      fadingLock.current = true;
      setFading(true);
      fadeTimer = window.setTimeout(() => {
        const nextLine = pickLine(lineRef.current, linesRef.current);
        const list = orderRef.current;
        const nextIndex =
          list.length > 0 ? (indexRef.current + 1) % list.length : 0;
        lineRef.current = nextLine;
        indexRef.current = nextIndex;
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
  const stageClass = `radio-banner-stage${fading ? " is-fading" : ""}`;
  const brand = <div className="radio-banner-l1">{BANNER_TITLE}</div>;
  const stage = (
    <>
      <BannerShot src={src} />
      <div className="radio-banner-txt">
        <div className="radio-banner-l2">{line}</div>
      </div>
    </>
  );
  const linkProps = {
    href: BANNER_HREF,
    target: "_blank" as const,
    rel: "noopener noreferrer",
  };

  return (
    <div className="radio-banner">
      {link ? (
        <a className="radio-banner-tier1" {...linkProps} tabIndex={-1} aria-hidden>
          {brand}
        </a>
      ) : (
        <div className="radio-banner-tier1">{brand}</div>
      )}
      {link ? (
        <a
          className={stageClass}
          {...linkProps}
          aria-label="Latigo Cowboy Authentics"
        >
          {stage}
        </a>
      ) : (
        <div className={stageClass}>{stage}</div>
      )}
      {children}
    </div>
  );
}
