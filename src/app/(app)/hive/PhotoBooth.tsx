"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIdleGate } from "@/lib/idle/gates";
import type { BoothBackdrop } from "@/lib/guestbook/backdrops";
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

type Step =
  | "camera-loading"
  | "live"
  | "camera-error"
  | "countdown"
  | "burst"
  | "reveal"
  | "saving"
  | "done";

type Shot = {
  id: string;
  blob: Blob;
  url: string;
  keep: boolean;
};

type Props = {
  hasProperty: boolean;
  backdrops: BoothBackdrop[];
};

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

  const [step, setStep] = useState<Step>("camera-loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [flash, setFlash] = useState(false);
  const [burstLabel, setBurstLabel] = useState<string | null>(null);
  const [selectedBackdropId, setSelectedBackdropId] = useState<string | null>(
    null,
  );
  const [liveBackdropOk, setLiveBackdropOk] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [whoName, setWhoName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLiveCanvas, setShowLiveCanvas] = useState(false);

  const hasBackdrops = backdrops.length > 0;
  const selectedBackdrop = backdrops.find((b) => b.id === selectedBackdropId);

  const captureActive =
    hasProperty &&
    step !== "done" &&
    step !== "camera-error";
  useIdleGate("guestbook-capture", captureActive);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStep("camera-loading");
    setCameraError(null);
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
  }, [stopCamera]);

  useEffect(() => {
    if (!hasProperty) return;
    void startCamera();
    return () => {
      stopCamera();
      cancelAnimationFrame(liveLoopRef.current);
    };
  }, [hasProperty, startCamera, stopCamera]);

  // Warm segmenter only when Hive has uploaded backdrops.
  useEffect(() => {
    if (!hasBackdrops) return;
    void loadSelfieSegmenter();
  }, [hasBackdrops]);

  // Load backdrop image when selection changes.
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

  // Live segmentation loop (low-res, ~12fps). Falls back silently if slow.
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
        .catch(() => {
          // Silent — keep plain preview.
        })
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
      for (const s of shots) URL.revokeObjectURL(s.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const runBurst = async () => {
    const video = videoRef.current;
    if (!video) {
      setStep("live");
      return;
    }

    setStep("burst");
    const captured: Shot[] = [];

    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        setBurstLabel("Next one!");
        await sleep(2000);
      }
      setBurstLabel(null);
      await flashAndShutter();
      const raw = await captureMirroredJpeg(video);
      if (!raw) continue;
      const finalBlob = await processCaptureBlob(raw);
      const url = URL.createObjectURL(finalBlob);
      captured.push({
        id: crypto.randomUUID(),
        blob: finalBlob,
        url,
        keep: true,
      });
    }

    if (captured.length === 0) {
      setSaveError("Could not capture photos. Try again.");
      setStep("live");
      return;
    }

    setShots(captured);
    setWhoName("");
    setSaveError(null);
    setStep("reveal");
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
        void runBurst();
        return;
      }
      playTick();
      setCountdown(n);
    }, 1000);
  };

  const toggleKeep = (id: string) => {
    setShots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, keep: !s.keep } : s)),
    );
  };

  const retake = () => {
    setShots((prev) => {
      for (const s of prev) URL.revokeObjectURL(s.url);
      return [];
    });
    setWhoName("");
    setSaveError(null);
    setStep("live");
  };

  const saveKept = async () => {
    const kept = shots.filter((s) => s.keep);
    if (kept.length === 0) {
      setSaveError("Keep at least one photo, or retake.");
      return;
    }
    setStep("saving");
    setSaveError(null);
    const caption = whoName.trim() || null;
    const takenAt = new Date().toISOString();

    try {
      for (const shot of kept) {
        const formData = new FormData();
        formData.set("photo", shot.blob, "guestbook.jpg");
        if (caption) formData.set("caption", caption);
        formData.set("taken_at", takenAt);
        const result = await saveGuestbookPhoto(formData);
        if (!result.ok) {
          setSaveError(result.error);
          setStep("reveal");
          return;
        }
      }
      setShots((prev) => {
        for (const s of prev) URL.revokeObjectURL(s.url);
        return [];
      });
      setStep("done");
    } catch {
      setSaveError("Could not save. Try again.");
      setStep("reveal");
    }
  };

  const takeAnother = () => {
    setWhoName("");
    setSaveError(null);
    void startCamera();
  };

  if (!hasProperty) {
    return (
      <div className="px-2 py-10 sm:px-0">
        <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Set a default home to open the Photo Booth.
        </p>
      </div>
    );
  }

  return (
    <div className="relative px-2 pb-8 sm:px-0">
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-[80] bg-white" />
      )}

      {(step === "countdown" || step === "burst") && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-stone-950/70">
          {step === "countdown" ? (
            <p
              key={countdown}
              className="font-[family-name:var(--font-fraunces)] text-[min(40vw,180px)] font-semibold leading-none text-white"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              {countdown}
            </p>
          ) : burstLabel ? (
            <p className="font-[family-name:var(--font-fraunces)] text-4xl font-semibold text-white sm:text-5xl">
              {burstLabel}
            </p>
          ) : null}
        </div>
      )}

      {step === "done" && <CelebrationBees />}

      <header className="mb-5 pt-4 text-center">
        <h1
          className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900 sm:text-4xl"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          Photo Booth
        </h1>
      </header>

      {(step === "camera-loading" ||
        step === "live" ||
        step === "countdown" ||
        step === "burst") && (
        <div className="mx-auto max-w-lg">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[24px] bg-stone-900 shadow-lg">
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
            {step === "camera-loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 text-white">
                Starting camera…
              </div>
            )}
          </div>

          {hasBackdrops && step === "live" && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setSelectedBackdropId(null)}
                className={`shrink-0 overflow-hidden rounded-[14px] border-2 transition ${
                  !selectedBackdropId
                    ? "border-[#F4B400]"
                    : "border-transparent"
                }`}
              >
                <span className="flex h-20 w-16 items-center justify-center bg-stone-200 text-xs font-semibold text-stone-700">
                  Original
                </span>
              </button>
              {backdrops.map((bd) => (
                <button
                  key={bd.id}
                  type="button"
                  onClick={() => setSelectedBackdropId(bd.id)}
                  className={`shrink-0 overflow-hidden rounded-[14px] border-2 transition ${
                    selectedBackdropId === bd.id
                      ? "border-[#F4B400]"
                      : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bd.url}
                    alt={bd.name || "Backdrop"}
                    className="h-20 w-16 object-cover"
                  />
                  {bd.name ? (
                    <span className="block max-w-16 truncate bg-stone-900/80 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                      {bd.name}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {step === "live" && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={beginCountdown}
                className="inline-flex min-h-[64px] w-full max-w-sm items-center justify-center rounded-[22px] bg-[#F4B400] px-6 text-lg font-semibold text-stone-900 shadow-md transition hover:bg-[#e0a800]"
              >
                Take your picture
              </button>
              <Link
                href="/hive/slideshow"
                className="text-sm font-medium text-stone-500 underline-offset-2 transition hover:text-stone-800 hover:underline"
              >
                See our memories
              </Link>
              {selectedBackdropId && !liveBackdropOk && (
                <p className="text-center text-xs text-stone-400">
                  Backdrop will apply when you snap
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {step === "camera-error" && (
        <div className="mx-auto max-w-md rounded-[20px] bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-base text-stone-700">{cameraError}</p>
          <p className="mt-3 text-sm text-stone-500">
            You can still browse the wall while the camera is unavailable.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/hive/slideshow"
              className="inline-flex min-h-[52px] items-center justify-center rounded-[18px] bg-[#F4B400] px-5 text-base font-semibold text-stone-900"
            >
              See our memories
            </Link>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="text-sm font-medium text-stone-600 underline-offset-2 hover:underline"
            >
              Try camera again
            </button>
          </div>
        </div>
      )}

      {(step === "reveal" || step === "saving") && (
        <div className="mx-auto max-w-lg">
          <p className="mb-4 text-center text-sm font-medium text-stone-600">
            Tap a print to keep or discard
          </p>
          <div className="flex flex-col gap-4">
            {shots.map((shot, i) => (
              <button
                key={shot.id}
                type="button"
                disabled={step === "saving"}
                onClick={() => toggleKeep(shot.id)}
                className={`reveal-print overflow-hidden rounded-[18px] bg-white p-2 shadow-md transition ${
                  shot.keep ? "ring-2 ring-[#F4B400]" : "opacity-45 grayscale"
                }`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`Shot ${i + 1}`}
                  className="aspect-[3/4] w-full rounded-[12px] object-cover"
                />
                <span className="mt-2 block text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {shot.keep ? "Keeping" : "Discarded"}
                </span>
              </button>
            ))}
          </div>

          <label className="mt-6 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-600">
              Who&apos;s in this one?{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </span>
            <input
              type="text"
              value={whoName}
              disabled={step === "saving"}
              onChange={(e) => setWhoName(e.target.value)}
              maxLength={120}
              placeholder="Names or a note"
              className="min-h-[48px] w-full rounded-[14px] border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
            />
          </label>

          {saveError && (
            <p className="mt-3 text-sm text-amber-800">{saveError}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={step === "saving"}
              onClick={retake}
              className="min-h-[52px] flex-1 rounded-[16px] border border-stone-200 text-base font-semibold text-stone-700"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={step === "saving"}
              onClick={() => void saveKept()}
              className="min-h-[52px] flex-1 rounded-[16px] bg-[#F4B400] text-base font-semibold text-stone-900 disabled:opacity-50"
            >
              {step === "saving" ? "Adding…" : "Add to the wall"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mx-auto max-w-md pt-10 text-center">
          <p
            className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
            style={{ fontVariationSettings: '"opsz" 72' }}
          >
            You&apos;re on the wall!
          </p>
          <button
            type="button"
            onClick={takeAnother}
            className="mt-8 inline-flex min-h-[56px] items-center justify-center rounded-[18px] bg-[#F4B400] px-8 text-base font-semibold text-stone-900"
          >
            Take another
          </button>
          <div className="mt-4">
            <Link
              href="/hive/slideshow"
              className="text-sm font-medium text-stone-500 underline-offset-2 hover:underline"
            >
              See our memories
            </Link>
          </div>
        </div>
      )}

      <style>{`
        .reveal-print {
          animation: boothSlideUp 0.55s ease-out both;
        }
        @keyframes boothSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .booth-bee {
          animation: boothBeeFlit 0.65s ease-out both;
        }
        .booth-bee::before,
        .booth-bee::after {
          content: "";
          position: absolute;
          top: -2px;
          width: 10px;
          height: 8px;
          background: rgba(255, 255, 255, 0.85);
          border-radius: 50%;
        }
        .booth-bee::before { left: -4px; }
        .booth-bee::after { right: -4px; }
        @keyframes boothBeeFlit {
          0% { transform: translate(0, 0) rotate(-10deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(112vw, var(--bee-dy)) rotate(16deg); opacity: 0; }
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
          className="booth-bee absolute h-4 w-5 rounded-full bg-[#F4B400] shadow-sm"
          style={{
            top: p.top,
            left: "-8%",
            ["--bee-dy" as string]: `${p.dy}px`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
