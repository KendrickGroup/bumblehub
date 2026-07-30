"use client";

import { FlipHorizontal2, MoveVertical, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ParlorPropIcon,
  PORTRAIT_CANVAS_H,
  PORTRAIT_CANVAS_W,
  PORTRAIT_MAX_PROP_FRAC,
  PORTRAIT_MIN_PROP,
} from "@/lib/guestbook/parlor-props";
import {
  clampScaleY,
  isOutsidePortrait,
  parlorFontCss,
  type PortraitOverlayObject,
  type PortraitTextOverlay,
} from "@/lib/guestbook/parlor-overlay";

type Props = {
  objects: PortraitOverlayObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeObject: (
    id: string,
    patch: Partial<PortraitOverlayObject>,
  ) => void;
  onBringToFront: (id: string) => void;
  onDelete: (id: string) => void;
  onCommitGesture: () => void;
  onGestureStart: () => void;
  onEditText: (id: string) => void;
  editingTextId: string | null;
  textDraft: string;
  onTextDraftChange: (value: string) => void;
  enabled: boolean;
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
      kind: "resize";
      id: string;
      pointerId: number;
      origW: number;
      origH: number;
      origRot: number;
      aspect: number;
      startAngle: number;
      startDist: number;
    }
  | {
      kind: "tilt";
      id: string;
      pointerId: number;
      startY: number;
      origScaleY: number;
    };

type Poof = { id: string; x: number; y: number; size: number };

const HANDLE_PX = 30;

function clampSize(w: number, h: number) {
  const maxW = PORTRAIT_CANVAS_W * PORTRAIT_MAX_PROP_FRAC;
  const maxH = PORTRAIT_CANVAS_H * PORTRAIT_MAX_PROP_FRAC;
  const nw = Math.min(maxW, Math.max(PORTRAIT_MIN_PROP, w));
  const nh = Math.min(maxH, Math.max(PORTRAIT_MIN_PROP, h));
  return { width: nw, height: nh };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Stage-space corner of a transformed object (matches CSS transform order). */
function objectCornerScreen(
  obj: PortraitOverlayObject,
  corner: "tl" | "tr" | "bl" | "br",
  stageScale: number,
): { x: number; y: number } {
  const flipX = obj.flipX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  const hw = (obj.width * stageScale) / 2;
  const hh = (obj.height * stageScale) / 2;
  let lx = corner === "tr" || corner === "br" ? hw : -hw;
  let ly = corner === "bl" || corner === "br" ? hh : -hh;
  lx *= flipX;
  ly *= scaleY;
  const rad = (obj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: obj.x * stageScale + lx * cos - ly * sin,
    y: obj.y * stageScale + lx * sin + ly * cos,
  };
}

function handleClassName() {
  return "absolute z-20 flex items-center justify-center rounded-full border-2 border-[#F4B400] bg-[#FFF8EA] text-[#3E2A1E] shadow-md";
}

/** Scrapbook-style gestures; throw off-frame or ✕ to delete. */
export function PortraitOverlayCanvas({
  objects,
  selectedId,
  onSelect,
  onChangeObject,
  onBringToFront,
  onDelete,
  onCommitGesture,
  onGestureStart,
  onEditText,
  editingTextId,
  textDraft,
  onTextDraftChange,
  enabled,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [poofs, setPoofs] = useState<Poof[]>([]);
  const [handlesHidden, setHandlesHidden] = useState(false);
  const gestureRef = useRef<ActiveGesture | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef(0);
  const pendingPatchRef = useRef<{
    id: string;
    patch: Partial<PortraitOverlayObject>;
  } | null>(null);
  const movedRef = useRef(false);
  const tapEditRef = useRef(false);

  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
  const selected = objects.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / PORTRAIT_CANVAS_W);
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
    (id: string, patch: Partial<PortraitOverlayObject>) => {
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

  const triggerPoof = (obj: PortraitOverlayObject) => {
    const id = `${obj.id}-poof-${Date.now()}`;
    const size = Math.max(obj.width, obj.height) * scale;
    setPoofs((prev) => [
      ...prev,
      { id, x: obj.x * scale, y: obj.y * scale, size },
    ]);
    window.setTimeout(() => {
      setPoofs((prev) => prev.filter((p) => p.id !== id));
    }, 320);
  };

  const endGesture = useCallback(
    (deleted?: boolean) => {
      clearLongPress();
      gestureRef.current = null;
      movedRef.current = false;
      setHandlesHidden(false);
      if (!deleted) onCommitGesture();
    },
    [onCommitGesture],
  );

  const deleteWithPoof = (obj: PortraitOverlayObject) => {
    onGestureStart();
    triggerPoof(obj);
    onDelete(obj.id);
    endGesture(true);
  };

  const onPointerDownObject = (
    e: ReactPointerEvent,
    obj: PortraitOverlayObject,
  ) => {
    if (!enabled) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    onSelect(obj.id);
    const pt = clientToCanvas(e.clientX, e.clientY);
    const g = gestureRef.current;
    movedRef.current = false;
    tapEditRef.current =
      obj.kind === "text" && selectedId === obj.id && editingTextId !== obj.id;

    if (g?.kind === "move" && g.id === obj.id) {
      const pointers = new Map<number, { x: number; y: number }>();
      pointers.set(g.pointerId, { x: g.startX, y: g.startY });
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
        aspect: obj.width / Math.max(1, obj.height),
      };
      setHandlesHidden(true);
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
    setHandlesHidden(true);
    onGestureStart();

    clearLongPress();
    longPressRef.current = setTimeout(() => {
      onBringToFront(obj.id);
    }, 500);
  };

  const onPointerDownResize = (
    e: ReactPointerEvent,
    obj: PortraitOverlayObject,
  ) => {
    if (!enabled) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(obj.id);
    const pt = clientToCanvas(e.clientX, e.clientY);
    gestureRef.current = {
      kind: "resize",
      id: obj.id,
      pointerId: e.pointerId,
      origW: obj.width,
      origH: obj.height,
      origRot: obj.rotation,
      aspect: obj.width / Math.max(1, obj.height),
      startAngle: angle({ x: obj.x, y: obj.y }, pt),
      startDist: dist({ x: obj.x, y: obj.y }, pt),
    };
    setHandlesHidden(true);
    onGestureStart();
  };

  const onPointerDownTilt = (
    e: ReactPointerEvent,
    obj: PortraitOverlayObject,
  ) => {
    if (!enabled) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(obj.id);
    const pt = clientToCanvas(e.clientX, e.clientY);
    gestureRef.current = {
      kind: "tilt",
      id: obj.id,
      pointerId: e.pointerId,
      startY: pt.y,
      origScaleY: obj.scaleY ?? 1,
    };
    setHandlesHidden(true);
    onGestureStart();
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!enabled) return;
    const g = gestureRef.current;
    if (!g) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    const obj = objects.find((o) => o.id === g.id);
    if (!obj) return;

    if (g.kind === "move" && e.pointerId === g.pointerId) {
      const dx = pt.x - g.startX;
      const dy = pt.y - g.startY;
      if (Math.hypot(dx, dy) > 4) {
        movedRef.current = true;
        clearLongPress();
      }
      schedulePatch(g.id, { x: g.origX + dx, y: g.origY + dy });
      return;
    }

    if (g.kind === "pinch") {
      if (!g.pointers.has(e.pointerId)) return;
      g.pointers.set(e.pointerId, pt);
      if (g.pointers.size < 2) return;
      movedRef.current = true;
      clearLongPress();
      const pts = [...g.pointers.values()];
      const d = dist(pts[0]!, pts[1]!);
      const a = angle(pts[0]!, pts[1]!);
      const scaleFactor = d / Math.max(1, g.startDist);
      const sizes = clampSize(g.origW * scaleFactor, g.origH * scaleFactor);
      const clamped = clampSize(sizes.width, sizes.width / g.aspect);
      schedulePatch(g.id, {
        width: clamped.width,
        height: clamped.width / g.aspect,
        rotation: g.origRot + (a - g.startAngle),
      });
      return;
    }

    if (g.kind === "resize" && e.pointerId === g.pointerId) {
      movedRef.current = true;
      const d = dist({ x: obj.x, y: obj.y }, pt);
      const a = angle({ x: obj.x, y: obj.y }, pt);
      const scaleFactor = d / Math.max(1, g.startDist);
      const width = Math.max(PORTRAIT_MIN_PROP, g.origW * scaleFactor);
      const clamped = clampSize(width, width / g.aspect);
      schedulePatch(g.id, {
        width: clamped.width,
        height: clamped.width / g.aspect,
        rotation: g.origRot + (a - g.startAngle),
      });
      return;
    }

    if (g.kind === "tilt" && e.pointerId === g.pointerId) {
      movedRef.current = true;
      // Drag down → more squash (brim-forward); drag up → upright (leaned back).
      const dy = pt.y - g.startY;
      const next = clampScaleY(g.origScaleY - dy / (PORTRAIT_CANVAS_H * 0.35));
      schedulePatch(g.id, { scaleY: next });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!enabled) return;
    const g = gestureRef.current;
    if (!g) return;

    if (g.kind === "pinch") {
      g.pointers.delete(e.pointerId);
      if (g.pointers.size >= 2) return;
      if (g.pointers.size === 1) {
        const [pid, p] = [...g.pointers.entries()][0]!;
        const obj = objects.find((o) => o.id === g.id);
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
      const obj = objects.find((o) => o.id === g.id);
      const wasTap = !movedRef.current;

      if (
        obj &&
        isOutsidePortrait(obj.x, obj.y, PORTRAIT_CANVAS_W, PORTRAIT_CANVAS_H)
      ) {
        triggerPoof(obj);
        onDelete(g.id);
        endGesture(true);
        return;
      }

      if (wasTap && obj?.kind === "text" && tapEditRef.current) {
        endGesture();
        onEditText(obj.id);
        return;
      }

      endGesture();
      return;
    }

    if (
      (g.kind === "resize" || g.kind === "tilt") &&
      e.pointerId === g.pointerId
    ) {
      endGesture();
    }
  };

  const showHandles =
    enabled && selected && editingTextId !== selected.id && !handlesHidden;

  return (
    <div
      ref={stageRef}
      className={`absolute inset-0 touch-none select-none ${
        enabled ? "" : "pointer-events-none"
      }`}
      onPointerDown={() => enabled && onSelect(null)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {sorted.map((obj) => {
        const isSelected = selectedId === obj.id;
        const editing = editingTextId === obj.id;
        const flipX = obj.flipX ?? 1;
        const scaleY = obj.scaleY ?? 1;

        return (
          <div
            key={obj.id}
            className="absolute"
            style={{
              left: obj.x * scale,
              top: obj.y * scale,
              width: obj.width * scale,
              height: obj.height * scale,
              transform: `translate(-50%, -50%) rotate(${obj.rotation}deg) scale(${flipX}, ${scaleY})`,
              zIndex: obj.zIndex,
              willChange: "transform",
            }}
            onPointerDown={(e) => onPointerDownObject(e, obj)}
          >
            {obj.kind === "prop" && (
              <ParlorPropIcon
                propId={obj.propId}
                className="h-full w-full object-contain"
              />
            )}
            {obj.kind === "text" && !editing && (
              <div
                className="flex h-full w-full items-center justify-center px-1 text-center leading-tight"
                style={{
                  fontFamily: parlorFontCss(obj.font),
                  color: obj.color,
                  fontSize: Math.max(14, obj.height * scale * 0.42),
                  fontWeight: 700,
                  textShadow:
                    obj.color === "#FAF3E3"
                      ? "0 1px 2px rgba(0,0,0,.45)"
                      : undefined,
                }}
              >
                {(obj as PortraitTextOverlay).text || "Tap to edit"}
              </div>
            )}
            {obj.kind === "text" && editing && (
              <textarea
                value={textDraft}
                onChange={(e) => onTextDraftChange(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={() => onEditText("")}
                autoFocus
                rows={2}
                className="h-full w-full resize-none rounded-md border-2 border-[#F4B400] bg-[#FFF8EA]/95 px-1 py-0.5 text-center leading-tight outline-none"
                style={{
                  fontFamily: parlorFontCss(obj.font),
                  color: obj.color,
                  fontSize: Math.max(14, obj.height * scale * 0.42),
                  fontWeight: 700,
                }}
              />
            )}

            {isSelected && enabled && !editing && !handlesHidden && (
              <div className="pointer-events-none absolute inset-[-4px] rounded-[6px] ring-2 ring-[#F4B400] ring-offset-1" />
            )}
          </div>
        );
      })}

      {showHandles && selected && (
        <>
          {/* Top-left: flip */}
          <button
            type="button"
            aria-label="Flip horizontally"
            className={handleClassName()}
            style={{
              width: HANDLE_PX,
              height: HANDLE_PX,
              left: objectCornerScreen(selected, "tl", scale).x,
              top: objectCornerScreen(selected, "tl", scale).y,
              transform: "translate(-50%, -50%)",
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(selected.id);
              onGestureStart();
              const next: 1 | -1 = (selected.flipX ?? 1) === 1 ? -1 : 1;
              onChangeObject(selected.id, { flipX: next });
              onCommitGesture();
            }}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>

          {/* Top-right: delete */}
          <button
            type="button"
            aria-label="Delete"
            className={handleClassName()}
            style={{
              width: HANDLE_PX,
              height: HANDLE_PX,
              left: objectCornerScreen(selected, "tr", scale).x,
              top: objectCornerScreen(selected, "tr", scale).y,
              transform: "translate(-50%, -50%)",
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              deleteWithPoof(selected);
            }}
          >
            <X className="h-4 w-4" strokeWidth={2.75} />
          </button>

          {/* Bottom-left: tilt */}
          <button
            type="button"
            aria-label="Tilt"
            className={handleClassName()}
            style={{
              width: HANDLE_PX,
              height: HANDLE_PX,
              left: objectCornerScreen(selected, "bl", scale).x,
              top: objectCornerScreen(selected, "bl", scale).y,
              transform: "translate(-50%, -50%)",
              touchAction: "none",
            }}
            onPointerDown={(e) => onPointerDownTilt(e, selected)}
          >
            <MoveVertical className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>

          {/* Bottom-right: resize + rotate */}
          <button
            type="button"
            aria-label="Resize and rotate"
            className={handleClassName()}
            style={{
              width: HANDLE_PX,
              height: HANDLE_PX,
              left: objectCornerScreen(selected, "br", scale).x,
              top: objectCornerScreen(selected, "br", scale).y,
              transform: "translate(-50%, -50%)",
              touchAction: "none",
            }}
            onPointerDown={(e) => onPointerDownResize(e, selected)}
          >
            <span className="block h-2.5 w-2.5 rotate-45 border-r-2 border-b-2 border-[#3E2A1E]" />
          </button>
        </>
      )}

      {poofs.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute z-[60] rounded-full bg-[#3E2A1E]/35"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            transform: "translate(-50%, -50%)",
            animation: "parlorPoof 0.3s ease-out forwards",
          }}
        />
      ))}
      <style>{`
        @keyframes parlorPoof {
          0% { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.15); }
        }
      `}</style>
    </div>
  );
}
