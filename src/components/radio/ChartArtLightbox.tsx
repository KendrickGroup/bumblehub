"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  src: string;
  title: string;
  footline: string | null;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ChartArtLightbox({ src, title, footline, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const lastTapRef = useRef(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length === 2) {
      panRef.current = null;
      pinchRef.current = {
        dist: pointerDistance(points[0], points[1]),
        scale,
      };
      return;
    }
    if (scale > 1) {
      panRef.current = {
        x: event.clientX,
        y: event.clientY,
        tx: offset.x,
        ty: offset.y,
      };
    }
    if (event.pointerType === "touch") {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        lastTapRef.current = 0;
        if (scale > 1) resetZoom();
        else setScale(2.2);
        panRef.current = null;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length >= 2 && pinchRef.current) {
      const nextDist = pointerDistance(points[0], points[1]);
      const ratio = nextDist / Math.max(pinchRef.current.dist, 1);
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinchRef.current.scale * ratio),
      );
      setScale(next);
      if (next <= MIN_SCALE) setOffset({ x: 0, y: 0 });
      return;
    }
    const pan = panRef.current;
    if (pan && scale > 1) {
      setOffset({
        x: pan.tx + (event.clientX - pan.x),
        y: pan.ty + (event.clientY - pan.y),
      });
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="radio-chart-lb">
      <button
        type="button"
        className="radio-chart-lb-scrim"
        aria-label="Close chart"
        onClick={onClose}
      />
      <button
        ref={closeRef}
        type="button"
        className="radio-chart-lb-close"
        aria-label="Close chart"
        onClick={onClose}
      >
        <X className="h-6 w-6" strokeWidth={2.25} />
      </button>
      <div
        className="radio-chart-lb-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="radio-chart-lb-title"
      >
        <div
          className="radio-chart-lb-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Image
            src={src}
            alt=""
            width={1200}
            height={800}
            sizes="100vw"
            draggable={false}
            className="radio-chart-lb-art"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
          />
        </div>
        <div className="radio-chart-lb-caption">
          <p id="radio-chart-lb-title" className="radio-chart-lb-kicker">
            {title}
          </p>
          {footline ? <p className="radio-chart-lb-foot">{footline}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
