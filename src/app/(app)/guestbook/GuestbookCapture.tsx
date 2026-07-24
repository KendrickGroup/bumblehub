"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIdleGate } from "@/lib/idle/gates";
import {
  BUILTIN_BACKDROPS,
  type CustomBackdrop,
  type GuestbookBackdrop,
} from "@/lib/guestbook/backdrops";
import {
  blobToImage,
  compositeWithBackdrop,
  loadSelfieSegmenter,
  segmentPersonMask,
} from "@/lib/guestbook/segmentation";
import { saveGuestbookPhoto } from "./actions";

type Step =
  | "camera-loading"
  | "camera-ready"
  | "camera-error"
  | "countdown"
  | "review"
  | "saving"
  | "done";

type Props = {
  propertyName: string;
  hasProperty: boolean;
  customBackdrops?: CustomBackdrop[];
};

function playTick() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 520;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.12);
    void ctx.close();
  } catch {
    // Optional audio, ignore failures.
  }
}

function captureMirroredFrame(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      resolve(null);
      return;
    }
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was denied. Allow camera permission in your browser settings, then try again.";
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

export function GuestbookCapture({
  propertyName,
  hasProperty,
  customBackdrops = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalBlobRef = useRef<Blob | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const personMaskRef = useRef<ImageData | null>(null);

  const [step, setStep] = useState<Step>("camera-loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [countdownPulse, setCountdownPulse] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureBlob, setCaptureBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [segmentReady, setSegmentReady] = useState(false);
  const [maskReady, setMaskReady] = useState(false);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(
    null,
  );
  const [selectedBackdropId, setSelectedBackdropId] = useState<string | null>(
    null,
  );
  const [compositing, setCompositing] = useState(false);

  const backdrops: GuestbookBackdrop[] = [
    ...BUILTIN_BACKDROPS,
    ...customBackdrops,
  ];

  const captureActive =
    hasProperty &&
    (step === "camera-loading" ||
      step === "camera-ready" ||
      step === "camera-error" ||
      step === "countdown" ||
      step === "review" ||
      step === "saving");
  useIdleGate("guestbook-capture", captureActive);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setStep("camera-loading");
    setCameraError(null);
    stopCamera();

    // Warm the segmenter in the background — silent if it fails.
    void loadSelfieSegmenter().then((seg) => {
      setSegmentReady(!!seg);
    });

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
      setStep("camera-ready");
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
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [hasProperty, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
    };
  }, [originalPreviewUrl]);

  const setPreviewFromBlob = (blob: Blob) => {
    setCaptureBlob(blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  };

  const clearCapture = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setOriginalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCaptureBlob(null);
    originalBlobRef.current = null;
    originalImageRef.current = null;
    personMaskRef.current = null;
    setMaskReady(false);
    setSelectedBackdropId(null);
    setCaption("");
    setSaveError(null);
  };

  const beginCountdown = () => {
    setCountdown(5);
    setStep("countdown");
    playTick();

    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          void finishCapture();
          return 0;
        }
        playTick();
        setCountdownPulse(true);
        window.setTimeout(() => setCountdownPulse(false), 180);
        return current - 1;
      });
    }, 1000);
  };

  const finishCapture = async () => {
    const video = videoRef.current;
    if (!video) return;

    const blob = await captureMirroredFrame(video);
    if (!blob) {
      setSaveError("Could not capture the photo. Try again.");
      setStep("camera-ready");
      return;
    }

    stopCamera();
    originalBlobRef.current = blob;
    personMaskRef.current = null;
    setMaskReady(false);
    setSelectedBackdropId(null);
    setPreviewFromBlob(blob);
    setOriginalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setCaption("");
    setSaveError(null);
    setStep("review");

    // Segment once in the background; strip appears when ready.
    if (segmentReady || (await loadSelfieSegmenter())) {
      try {
        const img = await blobToImage(blob);
        originalImageRef.current = img;
        const mask = await segmentPersonMask(img);
        if (mask) {
          personMaskRef.current = mask;
          setSegmentReady(true);
          setMaskReady(true);
        }
      } catch {
        // Graceful: backdrops stay hidden.
      }
    }
  };

  const applyBackdrop = async (backdropId: string | null) => {
    const original = originalBlobRef.current;
    if (!original) return;

    setSelectedBackdropId(backdropId);
    if (!backdropId) {
      setPreviewFromBlob(original);
      return;
    }

    const backdrop = backdrops.find((b) => b.id === backdropId);
    const mask = personMaskRef.current;
    let image = originalImageRef.current;
    if (!backdrop || !mask) return;

    setCompositing(true);
    try {
      if (!image) {
        image = await blobToImage(original);
        originalImageRef.current = image;
      }
      const composited = await compositeWithBackdrop(
        image,
        mask,
        backdrop.url,
      );
      if (composited) setPreviewFromBlob(composited);
    } catch {
      // Keep current preview.
    } finally {
      setCompositing(false);
    }
  };

  const retake = () => {
    clearCapture();
    void startCamera();
  };

  const submitPhoto = async () => {
    if (!captureBlob) return;
    setStep("saving");
    setSaveError(null);

    const formData = new FormData();
    formData.set("photo", captureBlob, "guestbook.jpg");
    if (caption.trim()) {
      formData.set("caption", caption.trim());
    }
    // Wall camera capture: "now" is the real taken time.
    formData.set("taken_at", new Date().toISOString());

    const result = await saveGuestbookPhoto(formData);
    if (!result.ok) {
      setSaveError(result.error);
      setStep("review");
      return;
    }

    setStep("done");
  };

  const takeAnother = () => {
    clearCapture();
    void startCamera();
  };

  const showBackdropStrip =
    (step === "review" || step === "saving") && maskReady;

  if (!hasProperty) {
    return (
      <div className="flex min-h-full flex-col bg-[#FAF8F3] px-6 py-10">
        <header className="mb-8">
          <Link
            href="/home"
            className="text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            ← Home
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-stone-900">
            Guestbook
          </h1>
        </header>
        <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Set a default hive in{" "}
          <code className="font-mono text-xs">user_settings</code> before adding
          guestbook photos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF8F3]">
      <header className="flex items-center justify-between px-6 pt-8 pb-4">
        <div>
          <Link
            href="/home"
            className="text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            ← Home
          </Link>
          <p className="mt-3 text-sm font-medium uppercase tracking-widest text-[#F4B400]">
            Guestbook
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">
            {propertyName}
          </h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-10">
        {step === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
            <div className="rounded-full bg-[#F4B400]/15 px-6 py-3 text-5xl">
              🐝
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-stone-900">
                You&apos;re in the guestbook!
              </h2>
              <p className="mt-2 text-stone-600">
                Your photo will show up in the guestbook slideshow.
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-3">
              <button
                type="button"
                onClick={takeAnother}
                className="min-h-[56px] rounded-[18px] bg-[#F4B400] text-lg font-semibold text-stone-900 transition hover:bg-[#e0a800]"
              >
                Take another photo
              </button>
              <Link
                href="/home"
                className="min-h-[56px] rounded-[18px] border border-stone-200 bg-white px-6 py-4 text-lg font-medium text-stone-800 transition hover:bg-stone-50"
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : step === "review" || step === "saving" ? (
          <div className="flex flex-1 flex-col gap-6">
            <div className="relative flex-1 overflow-hidden rounded-[20px] bg-stone-900 shadow-sm">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Captured guestbook photo"
                  className="h-full w-full object-cover"
                />
              )}
              {compositing && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/30">
                  <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">
                    Applying…
                  </p>
                </div>
              )}
            </div>

            {showBackdropStrip && (
              <div>
                <p className="mb-2 text-sm font-medium text-stone-600">
                  Backdrop
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    disabled={step === "saving" || compositing}
                    onClick={() => void applyBackdrop(null)}
                    className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-[14px] border-2 transition disabled:opacity-50 ${
                      selectedBackdropId === null
                        ? "border-[#F4B400]"
                        : "border-stone-200"
                    }`}
                  >
                    {originalPreviewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={originalPreviewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[10px] font-semibold text-white">
                      Original
                    </span>
                  </button>
                  {backdrops.map((bd) => (
                    <button
                      key={bd.id}
                      type="button"
                      disabled={step === "saving" || compositing}
                      onClick={() => void applyBackdrop(bd.id)}
                      className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-[14px] border-2 transition disabled:opacity-50 ${
                        selectedBackdropId === bd.id
                          ? "border-[#F4B400]"
                          : "border-stone-200"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bd.url}
                        alt={bd.label}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-0.5 py-0.5 text-center text-[10px] font-semibold text-white">
                        {bd.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-stone-600">
                Name or note{" "}
                <span className="font-normal text-stone-400">(optional)</span>
              </span>
              <input
                type="text"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={'e.g. "The Hendersons, summer \'26"'}
                maxLength={120}
                disabled={step === "saving"}
                className="mt-2 min-h-[52px] w-full rounded-[18px] border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-60"
              />
            </label>

            {saveError && (
              <p className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={retake}
                disabled={step === "saving"}
                className="min-h-[56px] rounded-[18px] border border-stone-200 bg-white text-lg font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void submitPhoto()}
                disabled={step === "saving"}
                className="min-h-[56px] rounded-[18px] bg-[#F4B400] text-lg font-semibold text-stone-900 transition hover:bg-[#e0a800] disabled:opacity-50"
              >
                {step === "saving" ? "Saving…" : "Add to guestbook"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            <div className="relative flex aspect-[3/4] w-full flex-1 overflow-hidden rounded-[20px] bg-stone-900 shadow-sm sm:aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${
                  step !== "camera-error" ? "[transform:scaleX(-1)]" : ""
                }`}
              />

              {step === "camera-loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60">
                  <p className="text-lg font-medium text-white">
                    Starting camera…
                  </p>
                </div>
              )}

              {step === "camera-error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#FAF8F3] px-6 text-center">
                  <p className="text-4xl">📷</p>
                  <p className="max-w-sm text-base text-stone-700">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="min-h-[52px] rounded-[18px] bg-[#F4B400] px-6 text-base font-semibold text-stone-900 hover:bg-[#e0a800]"
                  >
                    Try again
                  </button>
                </div>
              )}

              {step === "countdown" && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/35">
                  <span
                    key={countdown}
                    className={`text-[7rem] font-semibold leading-none text-white drop-shadow-lg transition-transform duration-150 ${
                      countdownPulse ? "scale-110" : "scale-100"
                    }`}
                  >
                    {countdown}
                  </span>
                </div>
              )}
            </div>

            {step === "camera-ready" && (
              <button
                type="button"
                onClick={beginCountdown}
                className="min-h-[64px] rounded-[18px] bg-[#F4B400] text-xl font-semibold text-stone-900 transition hover:bg-[#e0a800] active:scale-[0.99]"
              >
                Take our photo
              </button>
            )}

            {step === "countdown" && (
              <p className="text-center text-base text-stone-600">
                Get ready… smile!
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
