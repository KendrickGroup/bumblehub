"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { backgroundCss } from "@/lib/scrapbook/backgrounds";
import { StickerSvg } from "@/lib/scrapbook/stickers";
import { fontCssFamily } from "@/lib/scrapbook/flatten";
import {
  CANVAS_H,
  CANVAS_W,
  MAX_OBJECT_FRAC,
  MIN_OBJECT_SIZE,
  type ScrapbookObject,
  type ScrapbookDoc,
} from "@/lib/scrapbook/types";

type Props = {
  doc: ScrapbookDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeObject: (id: string, patch: Partial<ScrapbookObject>) => void;
  onBringToFront: (id: string) => void;
  onDelete: (id: string) => void;
  onEditText: (id: string) => void;
  onCommitGesture: () => void;
  onGestureStart: () => void;
};

type ActiveGesture =
  | {
      kind: "move";
      id: string;
      pointerId: number;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: "pinch";
      id: string;
      pointers: Map<number, { x: number; y: number }>;
      startDist: number;
      startAngle: number;
      origW: number;
      origH: number;
      origRot: number;
      aspect: number;
    }
  | {
      kind: "handle";
      id: string;
      pointerId: number;
      origW: number;
      origH: number;
      origRot: number;
      aspect: number;
      startAngle: number;
      startDist: number;
    };

function clampSize(w: number, h: number) {
  const maxW = CANVAS_W * MAX_OBJECT_FRAC;
  const maxH = CANVAS_H * MAX_OBJECT_FRAC;
  let nw = Math.min(maxW, Math.max(MIN_OBJECT_SIZE, w));
  let nh = Math.min(maxH, Math.max(MIN_OBJECT_SIZE, h));
  return { width: nw, height: nh };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function ScrapbookCanvas({
  doc,
  selectedId,
  onSelect,
  onChangeObject,
  onBringToFront,
  onDelete,
  onEditText,
  onCommitGesture,
  onGestureStart,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [trashHot, setTrashHot] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gestureRef = useRef<ActiveGesture | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  const rafRef = useRef(0);
  const pendingPatchRef = useRef<{
    id: string;
    patch: Partial<ScrapbookObject>;
  } | null>(null);

  const sorted = [...doc.objects].sort((a, b) => a.zIndex - b.zIndex);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / CANVAS_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clientToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [scale],
  );

  const flushPatch = useCallback(() => {
    rafRef.current = 0;
    const pending = pendingPatchRef.current;
    if (!pending) return;
    pendingPatchRef.current = null;
    onChangeObject(pending.id, pending.patch);
  }, [onChangeObject]);

  const schedulePatch = useCallback(
    (id: string, patch: Partial<ScrapbookObject>) => {
      pendingPatchRef.current = { id, patch };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushPatch);
      }
    },
    [flushPatch],
  );

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const endGesture = useCallback(
    (deleted?: boolean) => {
      clearLongPress();
      gestureRef.current = null;
      setDragging(false);
      setTrashHot(false);
      if (!deleted) onCommitGesture();
    },
    [onCommitGesture],
  );

  const onPointerDownObject = (
    e: ReactPointerEvent,
    obj: ScrapbookObject,
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const now = Date.now();
    const last = lastTapRef.current;
    if (obj.type === "text") {
      if (last && last.id === obj.id && now - last.t < 350) {
        lastTapRef.current = null;
        onSelect(obj.id);
        onEditText(obj.id);
        return;
      }
      if (selectedId === obj.id) {
        lastTapRef.current = { id: obj.id, t: now };
        onEditText(obj.id);
        return;
      }
    }
    lastTapRef.current = { id: obj.id, t: now };

    onSelect(obj.id);
    const pt = clientToCanvas(e.clientX, e.clientY);
    const g = gestureRef.current;

    if (g?.kind === "move" && g.id === obj.id) {
      // Upgrade to pinch
      const pointers = new Map<number, { x: number; y: number }>();
      pointers.set(g.pointerId, { x: g.startX, y: g.startY });
      // Approximate other start from current
      pointers.set(e.pointerId, pt);
      const pts = [...pointers.values()];
      gestureRef.current = {
        kind: "pinch",
        id: obj.id,
        pointers,
        startDist: dist(pts[0]!, pts[1]!),
        startAngle: angle(pts[0]!, pts[1]!),
        origW: obj.width,
        origH: obj.height,
        origRot: obj.rotation,
        aspect: obj.width / obj.height,
      };
      setDragging(true);
      return;
    }

    if (g?.kind === "pinch" && g.id === obj.id) {
      g.pointers.set(e.pointerId, pt);
      return;
    }

    gestureRef.current = {
      kind: "move",
      id: obj.id,
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      origX: obj.x,
      origY: obj.y,
    };
    setDragging(true);
    onGestureStart();

    clearLongPress();
    longPressRef.current = setTimeout(() => {
      onBringToFront(obj.id);
    }, 500);
  };

  const onPointerDownHandle = (
    e: ReactPointerEvent,
    obj: ScrapbookObject,
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(obj.id);
    const pt = clientToCanvas(e.clientX, e.clientY);
    gestureRef.current = {
      kind: "handle",
      id: obj.id,
      pointerId: e.pointerId,
      origW: obj.width,
      origH: obj.height,
      origRot: obj.rotation,
      aspect: obj.width / Math.max(1, obj.height),
      startAngle: angle({ x: obj.x, y: obj.y }, pt),
      startDist: dist({ x: obj.x, y: obj.y }, pt),
    };
    setDragging(true);
    onGestureStart();
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    const obj = doc.objects.find((o) => o.id === g.id);
    if (!obj) return;

    if (g.kind === "move" && e.pointerId === g.pointerId) {
      clearLongPress();
      const dx = pt.x - g.startX;
      const dy = pt.y - g.startY;
      const nx = g.origX + dx;
      const ny = g.origY + dy;
      schedulePatch(g.id, { x: nx, y: ny });
      const inTrash = ny > CANVAS_H * 0.78;
      setTrashHot(inTrash);
      return;
    }

    if (g.kind === "pinch") {
      if (!g.pointers.has(e.pointerId)) return;
      g.pointers.set(e.pointerId, pt);
      if (g.pointers.size < 2) return;
      const pts = [...g.pointers.values()];
      const d = dist(pts[0]!, pts[1]!);
      const a = angle(pts[0]!, pts[1]!);
      const scaleFactor = d / Math.max(1, g.startDist);
      const sizes = clampSize(g.origW * scaleFactor, g.origH * scaleFactor);
      // keep aspect
      const height = sizes.width / g.aspect;
      const clamped = clampSize(sizes.width, height);
      schedulePatch(g.id, {
        width: clamped.width,
        height: clamped.width / g.aspect,
        rotation: g.origRot + (a - g.startAngle),
      });
      return;
    }

    if (g.kind === "handle" && e.pointerId === g.pointerId) {
      const d = dist({ x: obj.x, y: obj.y }, pt);
      const a = angle({ x: obj.x, y: obj.y }, pt);
      const scaleFactor = d / Math.max(1, g.startDist);
      const width = Math.max(MIN_OBJECT_SIZE, g.origW * scaleFactor);
      const clamped = clampSize(width, width / g.aspect);
      schedulePatch(g.id, {
        width: clamped.width,
        height: clamped.width / g.aspect,
        rotation: g.origRot + (a - g.startAngle),
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;

    if (g.kind === "pinch") {
      g.pointers.delete(e.pointerId);
      if (g.pointers.size >= 2) return;
      if (g.pointers.size === 1) {
        const [pid, p] = [...g.pointers.entries()][0]!;
        const obj = doc.objects.find((o) => o.id === g.id);
        gestureRef.current = {
          kind: "move",
          id: g.id,
          pointerId: pid,
          startX: p.x,
          startY: p.y,
          origX: obj?.x ?? 0,
          origY: obj?.y ?? 0,
        };
        return;
      }
      endGesture();
      return;
    }

    if (g.kind === "move" && e.pointerId === g.pointerId) {
      const obj = doc.objects.find((o) => o.id === g.id);
      if (obj && obj.y > CANVAS_H * 0.78) {
        onDelete(g.id);
        endGesture(true);
        return;
      }
      endGesture();
      return;
    }

    if (g.kind === "handle" && e.pointerId === g.pointerId) {
      endGesture();
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,calc((100dvh-14rem)*4/3))]">
      <div
        ref={stageRef}
        className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-[16px] shadow-lg select-none"
        style={backgroundCss(doc.background)}
        onPointerDown={() => onSelect(null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {sorted.map((obj) => {
          const selected = selectedId === obj.id;
          return (
            <div
              key={obj.id}
              data-obj={obj.id}
              className="absolute"
              style={{
                left: obj.x * scale,
                top: obj.y * scale,
                width: obj.width * scale,
                height: obj.height * scale,
                transform: `translate(-50%, -50%) rotate(${obj.rotation}deg)`,
                zIndex: obj.zIndex,
                willChange: "transform",
              }}
              onPointerDown={(e) => onPointerDownObject(e, obj)}
            >
              {obj.type === "photo" && (
                <div
                  className="h-full w-full bg-white shadow-md"
                  style={{
                    padding: `${4 * scale}px ${4 * scale}px ${10 * scale}px`,
                    boxSizing: "border-box",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={obj.src}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              {obj.type === "sticker" && (
                <StickerSvg id={obj.stickerId} className="h-full w-full" />
              )}
              {obj.type === "text" && (
                <div
                  className="flex h-full w-full items-center justify-center px-1 text-center leading-tight"
                  style={{
                    fontFamily: fontCssFamily(obj.font),
                    color: obj.color,
                    fontSize: Math.max(12, obj.height * scale * 0.45),
                    fontWeight: 700,
                  }}
                >
                  {obj.text || "Tap to edit"}
                </div>
              )}

              {selected && (
                <>
                  <div className="pointer-events-none absolute inset-[-4px] rounded-[6px] ring-2 ring-[#F4B400] ring-offset-1" />
                  <button
                    type="button"
                    aria-label="Resize and rotate"
                    className="absolute right-[-14px] bottom-[-14px] z-10 h-7 w-7 rounded-full border-2 border-white bg-[#F4B400] shadow-md"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => onPointerDownHandle(e, obj)}
                  />
                </>
              )}
            </div>
          );
        })}

        {dragging && (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-[18%] items-center justify-center transition ${
              trashHot
                ? "bg-red-600/85 text-white"
                : "bg-stone-900/45 text-white/90"
            }`}
          >
            <span className="text-sm font-semibold tracking-wide">
              {trashHot ? "Release to delete" : "Drop here to delete"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
