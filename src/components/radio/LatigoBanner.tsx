"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BANNER_CHIP,
  BANNER_DEFAULT_LINE,
  BANNER_FADE_MS,
  BANNER_HOLD_RESUME_MS,
  BANNER_ROTATE_DEFAULT_SEC,
  BANNER_TITLE,
  DEFAULT_BANNER_CARD,
  bannerEventHandle,
  parseBannerRotateSeconds,
  type BannerCardSettings,
  type BannerProduct,
} from "@/lib/radio/banner";
import { frameImageStyle } from "@/lib/radio/banner-frame";
import { noteExpand } from "@/lib/radio/banner-log";
import { useBannerImpression } from "@/lib/radio/use-banner-impression";
import { shopifyImageUrl } from "@/lib/shopify/image";
import { BannerProductCard } from "@/components/radio/BannerProductCard";

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

function BannerShot({ product }: { product: BannerProduct | null }) {
  const [failed, setFailed] = useState(false);
  const src = product?.image ?? null;

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

  const frame = product?.frame ?? null;
  // A framed window blows the photo up, so ask the CDN for room to do it.
  const requested = frame ? Math.min(1600, Math.round(324 / frame.w)) : 800;

  return (
    <span className="radio-banner-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shopifyImageUrl(src, requested)}
        alt=""
        className={`radio-banner-thumb${frame ? " is-framed" : ""}`}
        style={frame ? frameImageStyle(frame) : undefined}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function LatigoBanner({
  products,
  lines,
  rotateSeconds = BANNER_ROTATE_DEFAULT_SEC,
  card = DEFAULT_BANNER_CARD,
  children,
}: {
  products: BannerProduct[];
  lines: string[];
  rotateSeconds?: number;
  card?: BannerCardSettings;
  children: ReactNode;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
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
  const pressKeyRef = useRef<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
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
    const ms = parseBannerRotateSeconds(rotateSeconds) * 1000;
    const id = window.setInterval(tick, ms);
    return () => {
      window.clearInterval(id);
      if (fadeTimer) window.clearTimeout(fadeTimer);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, [rotateSeconds]);

  const product = byImage.get(order[index] ?? "") ?? null;
  const pitch = product?.pitch.trim() || line;
  const name = product?.name.trim() ?? "";
  const openProduct = openKey ? byImage.get(openKey) ?? null : null;
  const stageClass = `radio-banner-stage${fading ? " is-fading" : ""}`;
  const ariaLabel = name ? `${name}. See it closer` : BANNER_TITLE;

  // Mid-crossfade the strip is dimmed and the card sits over it, so neither
  // moment is something a listener actually saw.
  useBannerImpression(
    stripRef,
    product ? bannerEventHandle(product) : "",
    name,
    fading || openKey !== null,
  );

  const hold = () => {
    heldRef.current = true;
    if (resumeTimer.current) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = undefined;
    }
  };

  const resumeSoon = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      heldRef.current = false;
      resumeTimer.current = undefined;
    }, BANNER_HOLD_RESUME_MS);
  };

  const scheduleResume = () => {
    // The card is a window into the product; nothing rotates behind it.
    if (openKey) return;
    resumeSoon();
  };

  const onPointerDown = () => {
    hold();
    pressKeyRef.current = product?.image ?? null;
  };

  /**
   * Open whichever product was under the thumb when the press began, so a
   * crossfade landing mid-tap can't swap the shirt out from under it.
   */
  const onClick = () => {
    const began = pressKeyRef.current;
    pressKeyRef.current = null;
    const key = began ?? product?.image ?? null;
    if (!key) return;
    hold();
    setOpenKey(key);
    const opened = byImage.get(key);
    if (opened) noteExpand(bannerEventHandle(opened), opened.name);
  };

  const closeCard = () => {
    setOpenKey(null);
    resumeSoon();
  };

  return (
    <div className="radio-banner" ref={stripRef}>
      <button
        type="button"
        className="radio-banner-hit"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        disabled={!product}
        onPointerEnter={hold}
        onPointerLeave={scheduleResume}
        onFocus={hold}
        onBlur={scheduleResume}
        onTouchStart={hold}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <div className="radio-banner-tier1" aria-hidden>
          <div className="radio-banner-l1">{BANNER_TITLE}</div>
        </div>
        <div className={stageClass} aria-hidden>
          <BannerShot product={product} />
          <div className="radio-banner-txt">
            <div className="radio-banner-name">{name}</div>
            <div className="radio-banner-pitch">{pitch}</div>
            <span className="radio-banner-chip">{BANNER_CHIP}</span>
          </div>
        </div>
      </button>
      {children}
      {openProduct ? (
        <BannerProductCard
          product={openProduct}
          card={card}
          onClose={closeCard}
        />
      ) : null}
    </div>
  );
}
