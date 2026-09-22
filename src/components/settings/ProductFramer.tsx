"use client";

/**
 * Picks the square window the 108px well shows. The photo moves and zooms under
 * a locked square, and the preview beside it is the real 108px well — judging a
 * thumbnail at poster size is how you end up with a postage-stamp design.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import {
  FRAME_DEFAULT_SIDE,
  FRAME_MIN_SIDE,
  frameCenter,
  frameFromSquare,
  frameImageStyle,
  frameSide,
  type BannerFrame,
} from "@/lib/radio/banner-frame";
import type { BannerProduct } from "@/lib/radio/banner";

type Props = {
  product: BannerProduct;
  onSave: (frame: BannerFrame) => void;
  onClose: () => void;
};

type Natural = { width: number; height: number };

const SAVE_DEBOUNCE_MS = 450;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ProductFramer({ product, onSave, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; side: number } | null>(null);
  const pan = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [natural, setNatural] = useState<Natural | null>(null);
  const [side, setSide] = useState(FRAME_DEFAULT_SIDE);
  const [center, setCenter] = useState({ cx: 0.5, cy: 0.5 });
  /**
   * Gestures read and write these, not the rendered state: a fast lift can put
   * the last move and the pointerup in one commit, and a save built from the
   * render closure would then miss the final inch of the drag.
   */
  const live = useRef({ side: FRAME_DEFAULT_SIDE, cx: 0.5, cy: 0.5 });

  const width = natural?.width ?? 0;
  const height = natural?.height ?? 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const frame = useMemo(
    () => frameFromSquare(side, center.cx, center.cy, width || 1, height || 1),
    [side, center, width, height],
  );

  const queueSave = useCallback(
    (next: BannerFrame) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onSave(next), SAVE_DEBOUNCE_MS);
    },
    [onSave],
  );

  const clampCenter = useCallback(
    (cx: number, cy: number, nextSide: number) => {
      const shortest = Math.min(width, height) || 1;
      const sidePx = nextSide * shortest;
      const halfW = sidePx / 2 / (width || 1);
      const halfH = sidePx / 2 / (height || 1);
      return {
        cx: clamp(cx, halfW, 1 - halfW),
        cy: clamp(cy, halfH, 1 - halfH),
      };
    },
    [width, height],
  );

  /** Single place the window changes, so refs and rendered state agree. */
  const applyWindow = useCallback(
    (nextSideRaw: number, cx: number, cy: number) => {
      const nextSide = clamp(nextSideRaw, FRAME_MIN_SIDE, 1);
      const nextCenter = clampCenter(cx, cy, nextSide);
      live.current = { side: nextSide, ...nextCenter };
      setSide(nextSide);
      setCenter(nextCenter);
    },
    [clampCenter],
  );

  const liveFrame = useCallback(
    () =>
      frameFromSquare(
        live.current.side,
        live.current.cx,
        live.current.cy,
        width || 1,
        height || 1,
      ),
    [width, height],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!natural) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A finger lifted between events; the gesture still tracks fine.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length === 2) {
      pan.current = null;
      pinch.current = { dist: distance(points[0]!, points[1]!), side: live.current.side };
      return;
    }
    pan.current = {
      x: event.clientX,
      y: event.clientY,
      cx: live.current.cx,
      cy: live.current.cy,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!natural || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;

    if (points.length >= 2 && pinch.current) {
      const ratio = distance(points[0]!, points[1]!) / Math.max(pinch.current.dist, 1);
      // Spreading fingers zooms in, which means a smaller window.
      applyWindow(pinch.current.side / ratio, live.current.cx, live.current.cy);
      return;
    }

    const grab = pan.current;
    if (!grab) return;
    const shortest = Math.min(width, height) || 1;
    const scale = stage.width / (live.current.side * shortest);
    const dx = (event.clientX - grab.x) / scale;
    const dy = (event.clientY - grab.y) / scale;
    applyWindow(
      live.current.side,
      grab.cx - dx / (width || 1),
      grab.cy - dy / (height || 1),
    );
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      pan.current = null;
      queueSave(liveFrame());
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!natural) return;
    event.preventDefault();
    applyWindow(
      live.current.side * (event.deltaY > 0 ? 1.06 : 0.94),
      live.current.cx,
      live.current.cy,
    );
    queueSave(liveFrame());
  };

  const reset = () => {
    applyWindow(FRAME_DEFAULT_SIDE, 0.5, 0.5);
    queueSave(liveFrame());
  };

  const done = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    onSave(liveFrame());
    onClose();
  };

  // The framing stage and the 108px preview are the same window at two sizes.
  const windowStyle = frameImageStyle(natural ? frame : null);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="framer">
      <button
        type="button"
        className="framer-scrim"
        aria-label="Close framing"
        onClick={onClose}
      />
      <div
        className="framer-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Frame ${product.name}`}
      >
        <div className="framer-head">
          <p className="framer-kicker">Frame the thumbnail</p>
          <button
            type="button"
            className="framer-close"
            aria-label="Close framing"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="framer-name">{product.name}</p>

        <div className="framer-body">
          <div
            ref={stageRef}
            className="framer-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onWheel={onWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt=""
              draggable={false}
              className="framer-img"
              style={windowStyle}
              onLoad={(event) => {
                /**
                 * The saved frame is fractions of this photo, so it only turns
                 * into side + center once the real dimensions are known. Doing
                 * it here rather than in an effect also means a save landing
                 * mid-drag can't snap the window back under the finger.
                 */
                const img = event.currentTarget;
                const w = img.naturalWidth || 1;
                const h = img.naturalHeight || 1;
                const opening = product.frame
                  ? {
                      side: frameSide(product.frame, w, h),
                      ...frameCenter(product.frame),
                    }
                  : { side: FRAME_DEFAULT_SIDE, cx: 0.5, cy: 0.5 };
                live.current = opening;
                setNatural({ width: w, height: h });
                setSide(opening.side);
                setCenter({ cx: opening.cx, cy: opening.cy });
              }}
            />
            <span className="framer-grid" aria-hidden />
          </div>

          <div className="framer-side">
            <p className="framer-label">Live at 108px</p>
            <span className="radio-banner-shot framer-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image}
                alt=""
                draggable={false}
                className="radio-banner-thumb is-framed"
                style={windowStyle}
              />
            </span>
            <p className="framer-hint">
              Drag to move. Pinch or scroll to zoom. This is the size it runs at
              on the cabinet.
            </p>
            <button type="button" className="framer-reset" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Recenter
            </button>
          </div>
        </div>

        <button type="button" className="framer-done" onClick={done}>
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
