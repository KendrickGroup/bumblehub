"use client";

import Link from "next/link";
import { Undo2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import { useIdleGate } from "@/lib/idle/gates";
import type { BoothBackdrop } from "@/lib/guestbook/backdrops";
import { renderCabinetCard } from "@/lib/guestbook/cabinet-card";
import { flattenPortraitWithProps } from "@/lib/guestbook/flatten-portrait-props";
import {
  FINISH_CSS,
  FINISH_LABELS,
  type PortraitFinish,
} from "@/lib/guestbook/finish";
import {
  costumesFromManifest,
  getParlorProp,
  ParlorPropIcon,
  PORTRAIT_CANVAS_H,
  PORTRAIT_CANVAS_W,
  ranchPropsFromManifest,
  type PortraitPropObject,
} from "@/lib/guestbook/parlor-props";
import {
  blobToImage,
  captureMirroredJpeg,
  compositeOntoCanvas,
  compositeWithBackdrop,
  drawMirroredVideoFrame,
  loadSelfieSegmenter,
  segmentPersonMask,
} from "@/lib/guestbook/segmentation";
import { saveGuestbookPhoto } from "@/app/(app)/guestbook/actions";
import { PortraitPropCanvas } from "./PortraitPropCanvas";

type Step =
  | "camera-loading"
  | "live"
  | "camera-error"
  | "countdown"
  | "posed"
  | "saving"
  | "done";

type Props = {
  hasProperty: boolean;
  backdrops: BoothBackdrop[];
};

const FINISHES: PortraitFinish[] = ["color", "sepia", "tintype"];
const COSTUME_SHELF = costumesFromManifest();
const PROP_SHELF = ranchPropsFromManifest();

function uid() {
  return crypto.randomUUID();
}

function playTick() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.stop(ctx.currentTime + 0.08);
    void ctx.close();
  } catch {
    // optional
  }
}

function playShutter() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = 180;
    gain.gain.value = 0.12;
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
  } catch {
    // optional
  }
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was denied. Allow the camera in your browser settings, then try again.";
    }
    if (error.name === "NotFoundError") {
      return "No camera found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is in use by another app. Close it and try again.";
    }
  }
  return "Could not start the camera. Check permissions and try again.";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function PhotoBooth({ hasProperty, backdrops }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const backdropImgRef = useRef<HTMLImageElement | null>(null);
  const liveLoopRef = useRef(0);
  const slowFramesRef = useRef(0);
  const liveEnabledRef = useRef(true);
  const selectedBackdropUrlRef = useRef<string | null>(null);
  const cleanBlobRef = useRef<Blob | null>(null);
  const nextZRef = useRef(1);

  const [step, setStep] = useState<Step>("camera-loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [flash, setFlash] = useState(false);
  const [selectedBackdropId, setSelectedBackdropId] = useState<string | null>(
    null,
  );
  const [liveBackdropOk, setLiveBackdropOk] = useState(false);
  const [showLiveCanvas, setShowLiveCanvas] = useState(false);
  const [finish, setFinish] = useState<PortraitFinish>("color");
  const [cleanUrl, setCleanUrl] = useState<string | null>(null);
  const [whoName, setWhoName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [props, setProps] = useState<PortraitPropObject[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<PortraitPropObject[] | null>(
    null,
  );

  const hasBackdrops = backdrops.length > 0;
  const selectedBackdrop = backdrops.find((b) => b.id === selectedBackdropId);

  const isLiveish =
    step === "live" || step === "camera-loading" || step === "countdown";
  const isPosed = step === "posed" || step === "saving";
  const isHung = step === "done";
  const shelvesActive = isPosed;
  const scenesActive = isLiveish;

  const captureActive =
    hasProperty && step !== "done" && step !== "camera-error";
  useIdleGate("guestbook-capture", captureActive);

  const finishFilterStyle = useMemo(
    (): CSSProperties => ({ filter: FINISH_CSS[finish] }),
    [finish],
  );

  const clearProps = useCallback(() => {
    setProps([]);
    setSelectedPropId(null);
    setUndoSnapshot(null);
    nextZRef.current = 1;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const setCleanPreview = useCallback((blob: Blob | null) => {
    setCleanUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blob ? URL.createObjectURL(blob) : null;
    });
  }, []);

  const startCamera = useCallback(async () => {
    setStep("camera-loading");
    setCameraError(null);
    clearProps();
    cleanBlobRef.current = null;
    setCleanPreview(null);
    setWhoName("");
    setSaveError(null);
    setSharePath(null);
    setQrDataUrl(null);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser.");
      setStep("camera-error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStep("live");
    } catch (error) {
      setCameraError(cameraErrorMessage(error));
      setStep("camera-error");
    }
  }, [clearProps, setCleanPreview, stopCamera]);

  useEffect(() => {
    if (!hasProperty) return;
    void startCamera();
    return () => {
      stopCamera();
      cancelAnimationFrame(liveLoopRef.current);
    };
    // Mount once with property — avoid re-running on startCamera identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProperty]);

  useEffect(() => {
    if (!hasBackdrops) return;
    void loadSelfieSegmenter();
  }, [hasBackdrops]);

  useEffect(() => {
    selectedBackdropUrlRef.current = selectedBackdrop?.url ?? null;
    backdropImgRef.current = null;
    setLiveBackdropOk(false);
    setShowLiveCanvas(false);
    liveEnabledRef.current = true;
    slowFramesRef.current = 0;

    if (!selectedBackdrop?.url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      backdropImgRef.current = img;
    };
    img.onerror = () => {
      backdropImgRef.current = null;
    };
    img.src = selectedBackdrop.url;
  }, [selectedBackdrop?.url]);

  useEffect(() => {
    if (step !== "live" || !selectedBackdropId || !hasBackdrops) {
      setShowLiveCanvas(false);
      return;
    }

    let cancelled = false;
    let lastTs = 0;
    let busy = false;
    const TARGET_MS = 1000 / 12;

    const tick = (now: number) => {
      if (cancelled) return;
      liveLoopRef.current = requestAnimationFrame(tick);
      if (!liveEnabledRef.current) {
        setShowLiveCanvas(false);
        return;
      }
      if (busy || now - lastTs < TARGET_MS) return;
      lastTs = now;

      const video = videoRef.current;
      const out = previewCanvasRef.current;
      const backdrop = backdropImgRef.current;
      if (!video || !out || !backdrop || video.readyState < 2) return;

      const frame = drawMirroredVideoFrame(video, 288);
      if (!frame) return;

      busy = true;
      const t0 = performance.now();
      void segmentPersonMask(frame)
        .then((mask) => {
          if (!mask || cancelled || !liveEnabledRef.current) return;
          out.width = frame.width;
          out.height = frame.height;
          const ok = compositeOntoCanvas(out, frame, mask, backdrop);
          const elapsed = performance.now() - t0;
          if (ok) {
            setShowLiveCanvas(true);
            setLiveBackdropOk(true);
          }
          if (elapsed > 90) {
            slowFramesRef.current += 1;
            if (slowFramesRef.current >= 4) {
              liveEnabledRef.current = false;
              setShowLiveCanvas(false);
              setLiveBackdropOk(false);
            }
          } else {
            slowFramesRef.current = Math.max(0, slowFramesRef.current - 1);
          }
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };

    liveLoopRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(liveLoopRef.current);
    };
  }, [step, selectedBackdropId, hasBackdrops]);

  useEffect(() => {
    return () => {
      if (cleanUrl) URL.revokeObjectURL(cleanUrl);
    };
  }, [cleanUrl]);

  const snapshotBefore = useCallback(() => {
    setUndoSnapshot(props.map((o) => ({ ...o })));
  }, [props]);

  const commitGesture = useCallback(() => {
    // Continuous transforms already live in props; undo was snapshotted at gesture start.
  }, []);

  const updateProp = useCallback(
    (id: string, patch: Partial<PortraitPropObject>) => {
      setProps((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      );
    },
    [],
  );

  const deleteProp = useCallback((id: string) => {
    setProps((prev) => prev.filter((o) => o.id !== id));
    setSelectedPropId((cur) => (cur === id ? null : cur));
  }, []);

  const bringPropFront = useCallback((id: string) => {
    nextZRef.current += 1;
    const z = nextZRef.current;
    setProps((prev) =>
      prev.map((o) => (o.id === id ? { ...o, zIndex: z } : o)),
    );
  }, []);

  const undo = () => {
    if (!undoSnapshot) return;
    setProps(undoSnapshot);
    setUndoSnapshot(null);
    setSelectedPropId(null);
  };

  const addProp = (propId: string) => {
    if (!shelvesActive) return;
    const def = getParlorProp(propId);
    if (!def) return;
    snapshotBefore();
    const size = def.defaultSize ?? 220;
    nextZRef.current += 1;
    const z = nextZRef.current;
    const obj: PortraitPropObject = {
      id: uid(),
      propId,
      x: PORTRAIT_CANVAS_W / 2 + (Math.random() * 80 - 40),
      y: PORTRAIT_CANVAS_H / 2 + (Math.random() * 80 - 40),
      width: size,
      height: size,
      rotation: Math.random() * 10 - 5,
      zIndex: z,
    };
    setProps((prev) => [...prev, obj]);
    setSelectedPropId(obj.id);
  };

  const flashAndShutter = async () => {
    playShutter();
    setFlash(true);
    await sleep(120);
    setFlash(false);
  };

  const processCaptureBlob = async (raw: Blob): Promise<Blob> => {
    const url = selectedBackdropUrlRef.current;
    if (!url) return raw;
    try {
      const img = await blobToImage(raw);
      const mask = await segmentPersonMask(img);
      if (!mask) return raw;
      const composited = await compositeWithBackdrop(img, mask, url);
      return composited ?? raw;
    } catch {
      return raw;
    }
  };

  const runCapture = async () => {
    const video = videoRef.current;
    if (!video) {
      setStep("live");
      return;
    }
    await flashAndShutter();
    const raw = await captureMirroredJpeg(video);
    if (!raw) {
      setSaveError("Could not capture the portrait. Try again.");
      setStep("live");
      return;
    }
    const clean = await processCaptureBlob(raw);
    cleanBlobRef.current = clean;
    setCleanPreview(clean);
    clearProps();
    setWhoName("");
    setSaveError(null);
    stopCamera();
    setStep("posed");
  };

  const beginCountdown = () => {
    setCountdown(3);
    setStep("countdown");
    playTick();
    let n = 3;
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        void runCapture();
        return;
      }
      playTick();
      setCountdown(n);
    }, 1000);
  };

  const retake = () => {
    void startCamera();
  };

  const hangPortrait = async () => {
    const clean = cleanBlobRef.current;
    if (!clean) return;
    setStep("saving");
    setSaveError(null);
    try {
      const flattened =
        (await flattenPortraitWithProps(clean, props, finish)) ?? clean;
      const finishedImg = await blobToImage(flattened);
      const cabinet = await renderCabinetCard(finishedImg);

      const formData = new FormData();
      formData.set("photo", flattened, "portrait.jpg");
      formData.set("taken_at", new Date().toISOString());
      if (whoName.trim()) formData.set("caption", whoName.trim());
      if (cabinet) formData.set("watermarked", cabinet, "cabinet.jpg");

      const result = await saveGuestbookPhoto(formData);
      if (!result.ok) {
        setSaveError(result.error);
        setStep("posed");
        return;
      }

      const path = result.shareUrl;
      setSharePath(path);
      if (path && typeof window !== "undefined") {
        const absolute = `${window.location.origin}${path}`;
        const qr = await QRCode.toDataURL(absolute, {
          margin: 1,
          width: 220,
          color: { dark: "#3E2A1E", light: "#FAF3E3" },
        });
        setQrDataUrl(qr);
      } else {
        setQrDataUrl(null);
      }

      setStep("done");
    } catch {
      setSaveError("Could not hang this portrait. Try again.");
      setStep("posed");
    }
  };

  const takeAnother = () => {
    void startCamera();
  };

  if (!hasProperty) {
    return (
      <div className="px-2 py-10 sm:px-0">
        <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Set a default home to open the portrait parlor.
        </p>
      </div>
    );
  }

  if (step === "camera-error") {
    return (
      <div className="parlor relative -mx-4 min-h-full bg-[#FAF3E3] px-4 pb-10 pt-5 sm:-mx-6 sm:px-6">
        <div className="relative mx-auto max-w-md rounded-[20px] bg-[#FFF8EA] px-6 py-10 text-center shadow-md">
          <p className="text-base text-[#3E2A1E]">{cameraError}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/hive/slideshow"
              className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] bg-[#F4B400] px-5 text-base font-semibold text-[#3E2A1E]"
            >
              See the wall
            </Link>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="text-sm font-medium text-[#5C4430] underline-offset-2 hover:underline"
            >
              Try the camera again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="parlor relative -mx-4 min-h-full bg-[#FAF3E3] px-4 pb-10 pt-5 sm:-mx-6 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(244,180,0,.08), transparent 40%), radial-gradient(circle at 80% 90%, rgba(179,64,42,.06), transparent 45%)",
        }}
      />

      {flash && (
        <div className="pointer-events-none fixed inset-0 z-[80] bg-white" />
      )}

      {step === "countdown" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#201A14]/80">
          <p
            key={countdown}
            className="font-[family-name:var(--font-rye)] text-[min(40vw,180px)] leading-none text-[#F4B400]"
          >
            {countdown}
          </p>
        </div>
      )}

      {isHung && <CelebrationBees />}

      <header className="relative mb-3 text-center">
        <div className="inline-block rounded-[14px] border-[3px] border-[#5C4430] bg-gradient-to-b from-[#4A3323] via-[#3E2A1E] to-[#2C1D14] px-8 py-3.5 shadow-[0_6px_0_#2C1D14,0_12px_24px_rgba(44,29,20,.35)]">
          <h1 className="font-[family-name:var(--font-rye)] text-[clamp(1.35rem,4.5vw,2.5rem)] leading-tight tracking-wide text-[#F4B400] [text-shadow:0_2px_0_rgba(0,0,0,.45)]">
            Latigo Cowboy Portrait Co.
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-[#D9BE8C]">
            ★ Est. at the cabin ★
          </p>
        </div>
        <p className="mt-3 -rotate-[1.2deg] font-[family-name:var(--font-marker)] text-[clamp(0.95rem,2.5vw,1.25rem)] text-[#B3402A]">
          {isHung
            ? "You're on the wall!"
            : isPosed
              ? "Dress it up. Hang it up."
              : "Dress up. Pick a scene. Hold real still."}
        </p>
      </header>

      <div className="relative mx-auto flex w-full max-w-[1100px] flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-5">
        {/* Costume rack */}
        <aside
          className={`flex w-full flex-row flex-wrap items-center justify-center gap-2.5 transition-opacity lg:w-[120px] lg:flex-col lg:pt-3 ${
            shelvesActive ? "opacity-100" : "opacity-40"
          } ${shelvesActive ? "" : "pointer-events-none"}`}
        >
          <div className="text-center lg:w-full">
            <p className="-rotate-3 font-[family-name:var(--font-marker)] text-sm text-[#3E2A1E]">
              Costume rack
            </p>
            {!shelvesActive && (
              <p className="mt-0.5 font-[family-name:var(--font-marker)] text-[11px] text-[#B3402A]/90">
                snap first, then decorate
              </p>
            )}
          </div>
          {COSTUME_SHELF.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.name}
              disabled={!shelvesActive || step === "saving"}
              onClick={() => addProp(item.id)}
              className="flex h-[74px] w-[74px] items-center justify-center rounded-2xl border-2 border-dashed border-[#3E2A1E]/25 bg-[#FFF8EA] p-2 shadow-[0_3px_8px_rgba(44,29,20,.12)] transition enabled:active:scale-95 enabled:hover:border-[#F4B400] enabled:hover:shadow-md disabled:cursor-default"
            >
              <ParlorPropIcon propId={item.id} className="h-full w-full" />
            </button>
          ))}
          <span className="rounded-full bg-[#F4B400]/25 px-3 py-1.5 text-xs font-semibold text-[#3E2A1E]">
            +10 more
          </span>
        </aside>

        {/* Marquee */}
        <div className="relative w-full max-w-[520px] shrink-0">
          <div className="relative rounded-[26px] bg-gradient-to-b from-[#4A3323] to-[#3E2A1E] p-[26px] shadow-[0_10px_0_#2C1D14,0_22px_40px_rgba(44,29,20,.35)]">
            <MarqueeBulbs />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-[#201A14]">
              <div className="absolute inset-0" style={finishFilterStyle}>
                {isLiveish && (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className={`absolute inset-0 h-full w-full object-cover ${
                        showLiveCanvas ? "opacity-0" : "opacity-100"
                      }`}
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <canvas
                      ref={previewCanvasRef}
                      className={`absolute inset-0 h-full w-full object-cover ${
                        showLiveCanvas ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </>
                )}

                {cleanUrl && (isPosed || isHung) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cleanUrl}
                    alt="Your portrait"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                )}

                {(isPosed || isHung) && (
                  <PortraitPropCanvas
                    objects={props}
                    selectedId={selectedPropId}
                    onSelect={setSelectedPropId}
                    onChangeObject={updateProp}
                    onBringToFront={bringPropFront}
                    onDelete={deleteProp}
                    onCommitGesture={commitGesture}
                    onGestureStart={snapshotBefore}
                    enabled={step === "posed"}
                  />
                )}
              </div>

              {isLiveish && (
                <span className="absolute top-3 left-3 z-[5] rounded-md bg-[#B3402A] px-2.5 py-1 text-[11px] font-extrabold tracking-[0.15em] text-[#FFF8EA]">
                  <span className="mr-1.5 inline-block animate-pulse text-[#FFD9CF]">
                    ●
                  </span>
                  LIVE
                </span>
              )}
              {isPosed && (
                <span className="absolute top-3 left-3 z-[5] rounded-md bg-[#3E2A1E]/85 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.15em] text-[#F4B400]">
                  POSED
                </span>
              )}
              {isHung && (
                <span className="absolute top-3 left-3 z-[5] rounded-md bg-[#F4B400] px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-[#3E2A1E]">
                  ON THE WALL
                </span>
              )}
              {step === "camera-loading" && (
                <div className="absolute inset-0 z-[6] flex items-center justify-center bg-[#201A14]/70 text-[#FAF3E3]">
                  Warming up the box…
                </div>
              )}
            </div>
          </div>

          {/* Finish chips — live + posed */}
          {(isLiveish || isPosed) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="-rotate-1 font-[family-name:var(--font-marker)] text-sm text-[#3E2A1E]">
                Finish:
              </span>
              {FINISHES.map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={step === "saving" || step === "countdown"}
                  onClick={() => setFinish(f)}
                  className={`inline-flex items-center gap-2 rounded-full border-2 bg-[#FFF8EA] py-1.5 pr-3.5 pl-2 text-[13px] font-semibold text-[#3E2A1E] transition ${
                    finish === f
                      ? "border-[#F4B400] shadow-[0_0_0_3px_rgba(244,180,0,.3)]"
                      : "border-[#3E2A1E]/20"
                  }`}
                >
                  <FinishSwatch finish={f} />
                  {FINISH_LABELS[f]}
                </button>
              ))}
              {isPosed && (
                <button
                  type="button"
                  disabled={!undoSnapshot || step === "saving"}
                  onClick={undo}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#3E2A1E]/20 bg-[#FFF8EA] px-3 py-1.5 text-[13px] font-semibold text-[#3E2A1E] disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </button>
              )}
            </div>
          )}

          {/* Scene cards */}
          <div
            className={`mt-4 transition-opacity ${
              scenesActive ? "opacity-100" : "pointer-events-none opacity-40"
            }`}
          >
            <p className="-rotate-1 font-[family-name:var(--font-marker)] text-[15px] text-[#3E2A1E]">
              Pick your scene:
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2.5">
              <SceneCard
                active={!selectedBackdropId}
                tilt="-2.5deg"
                name="No scene"
                onClick={() => scenesActive && setSelectedBackdropId(null)}
              >
                <span className="flex h-full items-center justify-center bg-[#EEE3CC] text-xs font-extrabold text-[#3E2A1E]">
                  AS-IS
                </span>
              </SceneCard>
              {backdrops.map((bd, i) => {
                const tilts = ["-1.5deg", "1.5deg", "-1deg", "2deg", "-2deg"];
                return (
                  <SceneCard
                    key={bd.id}
                    active={selectedBackdropId === bd.id}
                    tilt={tilts[i % tilts.length]!}
                    name={bd.name || "Scene"}
                    stamp={i === 0}
                    onClick={() =>
                      scenesActive && setSelectedBackdropId(bd.id)
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bd.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </SceneCard>
                );
              })}
            </div>
            {selectedBackdropId && !liveBackdropOk && step === "live" && (
              <p className="mt-2 text-center text-xs text-[#5C4430]/80">
                Scene will land when you strike the pose
              </p>
            )}
          </div>
        </div>

        {/* Ranch props */}
        <aside
          className={`flex w-full flex-row flex-wrap items-center justify-center gap-2.5 transition-opacity lg:w-[120px] lg:flex-col lg:pt-3 ${
            shelvesActive ? "opacity-100" : "opacity-40"
          } ${shelvesActive ? "" : "pointer-events-none"}`}
        >
          <div className="text-center lg:w-full">
            <p className="-rotate-3 font-[family-name:var(--font-marker)] text-sm text-[#3E2A1E]">
              Ranch props
            </p>
            {!shelvesActive && (
              <p className="mt-0.5 font-[family-name:var(--font-marker)] text-[11px] text-[#B3402A]/90">
                snap first, then decorate
              </p>
            )}
          </div>
          {PROP_SHELF.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.name}
              disabled={!shelvesActive || step === "saving"}
              onClick={() => addProp(item.id)}
              className="flex h-[74px] w-[74px] items-center justify-center rounded-2xl border-2 border-dashed border-[#3E2A1E]/25 bg-[#FFF8EA] p-2 shadow-[0_3px_8px_rgba(44,29,20,.12)] transition enabled:active:scale-95 enabled:hover:border-[#F4B400] enabled:hover:shadow-md disabled:cursor-default"
            >
              <ParlorPropIcon propId={item.id} className="h-full w-full" />
            </button>
          ))}
          <span className="rounded-full bg-[#F4B400]/25 px-3 py-1.5 text-xs font-semibold text-[#3E2A1E]">
            +13 more
          </span>
        </aside>
      </div>

      {/* Footer actions by state */}
      {step === "live" && (
        <div className="relative mt-8 flex flex-col items-center gap-4">
          <div className="flex h-[190px] w-[190px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_40%_30%,#F7E19A,#F4B400_60%,#B8860B)] shadow-[0_6px_14px_rgba(44,29,20,.3),inset_0_2px_4px_rgba(255,255,255,.5)]">
            <button
              type="button"
              onClick={beginCountdown}
              className="h-[150px] w-[150px] rounded-full border-0 bg-[radial-gradient(circle_at_35%_28%,#E9705A,#B3402A_55%,#7E2A1B)] font-[family-name:var(--font-rye)] text-[28px] leading-none tracking-wide text-[#FFF8EA] shadow-[0_10px_0_#6B2416,0_18px_30px_rgba(44,29,20,.4),inset_0_-6px_12px_rgba(0,0,0,.25)] transition active:translate-y-2 active:shadow-[0_2px_0_#6B2416]"
            >
              STRIKE
              <br />A POSE
              <span className="mt-1 block font-[family-name:var(--font-bricolage)] text-[11px] font-semibold tracking-wide text-[#FFD9CF]">
                hold real still
              </span>
            </button>
          </div>
          <Link
            href="/hive/scrapbook"
            className="relative -rotate-[1.4deg] rounded-md border-2 border-dashed border-[#B3402A] bg-[#FFF8EA] px-8 py-3.5 text-base font-extrabold text-[#B3402A] transition hover:rotate-0 hover:scale-[1.04]"
          >
            Scrapbook a page
          </Link>
          <Link
            href="/hive/slideshow"
            className="text-sm font-semibold text-[#3E2A1E]/75 transition hover:text-[#B3402A]"
          >
            See the wall →
          </Link>
        </div>
      )}

      {isPosed && (
        <div className="relative mx-auto mt-8 max-w-md">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#3E2A1E]">
              Who&apos;s in this one?{" "}
              <span className="font-normal text-[#5C4430]/70">(optional)</span>
            </span>
            <input
              type="text"
              value={whoName}
              disabled={step === "saving"}
              onChange={(e) => setWhoName(e.target.value)}
              maxLength={120}
              placeholder="Names or a note"
              className="min-h-[48px] w-full rounded-[14px] border border-[#3E2A1E]/20 bg-[#FFF8EA] px-4 text-base text-[#3E2A1E] focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            />
          </label>

          {saveError && (
            <p className="mt-3 text-sm text-[#B3402A]">{saveError}</p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={step === "saving"}
              onClick={retake}
              className="min-h-[52px] flex-1 rounded-[16px] border-2 border-[#3E2A1E]/20 bg-transparent text-base font-semibold text-[#5C4430]/85"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={step === "saving"}
              onClick={() => void hangPortrait()}
              className="min-h-[52px] flex-1 rounded-[16px] bg-[#F4B400] text-base font-semibold text-[#3E2A1E] disabled:opacity-50"
            >
              {step === "saving" ? "Hanging…" : "Hang it on the wall"}
            </button>
          </div>
        </div>
      )}

      {isHung && (
        <div className="relative mx-auto mt-8 max-w-md text-center">
          {qrDataUrl && sharePath && (
            <div className="rounded-[18px] border-2 border-[#5C4430] bg-[#FFF8EA] px-5 py-6 shadow-md">
              <p className="font-[family-name:var(--font-marker)] text-lg text-[#3E2A1E]">
                Take it home:
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Scan to download your cabinet card"
                className="mx-auto mt-4 h-[220px] w-[220px] rounded-lg"
              />
              <p className="mt-3 text-sm font-medium text-[#5C4430]">
                Scan with your phone camera.
              </p>
            </div>
          )}
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={takeAnother}
              className="inline-flex min-h-[56px] items-center justify-center rounded-[18px] bg-[#F4B400] px-8 text-base font-semibold text-[#3E2A1E]"
            >
              Take another
            </button>
            <Link
              href="/hive/slideshow"
              className="text-sm font-semibold text-[#3E2A1E]/75 hover:text-[#B3402A]"
            >
              Done
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FinishSwatch({ finish }: { finish: PortraitFinish }) {
  const cls =
    finish === "color"
      ? "bg-[conic-gradient(#E8A64F,#7C8B6F,#9FB4C7,#B3402A,#E8A64F)]"
      : finish === "sepia"
        ? "bg-[linear-gradient(135deg,#D9B98A,#8A6B4F)]"
        : "bg-[linear-gradient(135deg,#CFCFCF,#4A4A4A)]";
  return (
    <span
      className={`h-[22px] w-[22px] rounded-full border border-black/15 ${cls}`}
    />
  );
}

function SceneCard({
  active,
  tilt,
  name,
  stamp,
  onClick,
  children,
}: {
  active: boolean;
  tilt: string;
  name: string;
  stamp?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-[86px] overflow-hidden rounded-[10px] border-[3px] bg-[#FFF8EA] shadow-[0_4px_10px_rgba(44,29,20,.18)] transition hover:scale-105 hover:rotate-0 ${
        active
          ? "border-[#F4B400] shadow-[0_0_0_3px_rgba(244,180,0,.35),0_4px_10px_rgba(44,29,20,.18)]"
          : "border-[#FFF8EA]"
      }`}
      style={{ transform: active ? undefined : `rotate(${tilt})` }}
    >
      <div className="h-[58px] overflow-hidden">{children}</div>
      <div className="truncate px-1 py-1 text-center text-[11px] font-semibold text-[#3E2A1E]">
        {name}
      </div>
      {stamp ? (
        <span className="absolute top-1 right-1 rounded bg-[#F4B400] px-1 text-[10px] font-extrabold text-[#2C1D14]">
          ★
        </span>
      ) : null}
    </button>
  );
}

function MarqueeBulbs() {
  const positions: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    positions.push([i * 10, 0], [i * 10, 100]);
  }
  for (let i = 1; i < 10; i++) {
    positions.push([0, i * 10], [100, i * 10]);
  }
  return (
    <div className="pointer-events-none absolute inset-2 rounded-[20px]">
      {positions.map(([x, y], i) => (
        <span
          key={`${x}-${y}-${i}`}
          className="absolute h-3 w-3 rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFF3C4,#F4B400_55%,#C98F00)] shadow-[0_0_10px_2px_rgba(244,180,0,.75)]"
          style={{
            left: `calc(${x}% - 6px)`,
            top: `calc(${y}% - 6px)`,
            animation: `parlorTwinkle 1.8s ease-in-out ${(i % 6) * 0.3}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes parlorTwinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

function CelebrationBees() {
  const paths = [
    { top: "28%", delay: "0ms", dy: -24 },
    { top: "46%", delay: "90ms", dy: 12 },
    { top: "64%", delay: "160ms", dy: -10 },
  ];
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden
    >
      {paths.map((p, i) => (
        <span
          key={i}
          className="parlor-bee absolute h-4 w-5 rounded-full bg-[#F4B400] shadow-sm"
          style={{
            top: p.top,
            left: "-8%",
            ["--bee-dy" as string]: `${p.dy}px`,
            animationDelay: p.delay,
          }}
        />
      ))}
      <style>{`
        .parlor-bee { animation: parlorBeeFlit 0.65s ease-out both; }
        .parlor-bee::before, .parlor-bee::after {
          content: ""; position: absolute; top: -2px; width: 10px; height: 8px;
          background: rgba(255,255,255,0.85); border-radius: 50%;
        }
        .parlor-bee::before { left: -4px; }
        .parlor-bee::after { right: -4px; }
        @keyframes parlorBeeFlit {
          0% { transform: translate(0,0) rotate(-10deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(112vw, var(--bee-dy)) rotate(16deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
