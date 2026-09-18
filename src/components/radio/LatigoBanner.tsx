"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  BANNER_CHIP,
  BANNER_DEFAULT_LINE,
  BANNER_FADE_MS,
  BANNER_HOLD_RESUME_MS,
  BANNER_ROTATE_MS,
  BANNER_TITLE,
  bannerProductHref,
  type BannerProduct,
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
  products,
  lines,
  link,
  children,
}: {
  products: BannerProduct[];
  lines: string[];
  link: boolean;
  children: ReactNode;
}) {
  const [order, setOrder] = useState<string[]>(() =>
    shuffle(products.map((item) => item.image)),
  );
  const [index, setIndex] = useState(0);
  const [line, setLine] = useState(BANNER_DEFAULT_LINE);
  const [fading, setFading] = useState(false);
  const lineRef = useRef(BANNER_DEFAULT_LINE);
  const indexRef = useRef(0);
  const orderRef = useRef(order);
  const linesRef = useRef(lines);
  const fadingLock = useRef(false);
  const heldRef = useRef(false);
  const resumeTimer = useRef<number | undefined>(undefined);
  const pressHrefRef = useRef<string | null>(null);
  const hrefRef = useRef("");
  const productKey = products.map((item) => item.image).join("\n");
  const byImage = useMemo(() => {
    const map = new Map<string, BannerProduct>();
    for (const item of products) map.set(item.image, item);
    return map;
  }, [products]);

  linesRef.current = lines;

  useEffect(() => {
    const next = shuffle(productKey ? productKey.split("\n") : []);
    setOrder(next);
    setIndex(0);
    orderRef.current = next;
    indexRef.current = 0;
  }, [productKey]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    if (lines.length === 0) return;
    setLine((current) => {
      if (current && current !== BANNER_DEFAULT_LINE) return current;
      const next = pickLine(current, lines);
      lineRef.current = next;
      return next;
    });
  }, [lines]);

  useEffect(() => {
    let fadeTimer: number | undefined;
    const tick = () => {
      if (heldRef.current || fadingLock.current) return;
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
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  const product = byImage.get(order[index] ?? "") ?? null;
  const pitch = product?.pitch.trim() || line;
  const name = product?.name.trim() ?? "";
  const href = bannerProductHref(product?.url ?? "");
  hrefRef.current = href;
  const stageClass = `radio-banner-stage${fading ? " is-fading" : ""}`;
  const ariaLabel = name
    ? `${name}. ${BANNER_CHIP}`
    : `${BANNER_TITLE}. ${BANNER_CHIP}`;

  const hold = () => {
    heldRef.current = true;
    if (resumeTimer.current) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = undefined;
    }
  };

  const scheduleResume = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      heldRef.current = false;
      resumeTimer.current = undefined;
    }, BANNER_HOLD_RESUME_MS);
  };

  const onPointerDown = () => {
    hold();
    pressHrefRef.current = hrefRef.current;
  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const began = pressHrefRef.current;
    pressHrefRef.current = null;
    if (fadingLock.current) {
      event.preventDefault();
      if (began) window.open(began, "_blank", "noopener,noreferrer");
      return;
    }
    if (began && began !== hrefRef.current) {
      event.preventDefault();
      window.open(began, "_blank", "noopener,noreferrer");
    }
  };

  const brand = <div className="radio-banner-l1">{BANNER_TITLE}</div>;
  const stage = (
    <>
      <BannerShot src={product?.image ?? null} />
      <div className="radio-banner-txt">
        <div className="radio-banner-name">{name}</div>
        <div className="radio-banner-pitch">{pitch}</div>
        <span className="radio-banner-chip" aria-hidden>
          {BANNER_CHIP}
        </span>
      </div>
    </>
  );

  return (
    <div className="radio-banner">
      {link ? (
        <a
          className="radio-banner-hit"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          onPointerEnter={hold}
          onPointerLeave={scheduleResume}
          onFocus={hold}
          onBlur={scheduleResume}
          onTouchStart={hold}
          onPointerDown={onPointerDown}
          onClick={onClick}
        >
          <div className="radio-banner-tier1" aria-hidden>
            {brand}
          </div>
          <div className={stageClass} aria-hidden>
            {stage}
          </div>
        </a>
      ) : (
        <>
          <div className="radio-banner-tier1">{brand}</div>
          <div className={stageClass}>{stage}</div>
        </>
      )}
      {children}
    </div>
  );
}
