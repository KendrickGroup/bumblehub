/** Brief analog-radio static burst on retune. Never blocks stream playback. */

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioCtx();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap handler. Do not await — stream play() must stay synchronous. */
export function unlockStaticCrackle() {
  const audioCtx = getAudioContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {
      // iOS may deny WebAudio; the stream still plays.
    });
  }
}

export function playStaticCrackle() {
  if (typeof window === "undefined") return;
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    if (audioCtx.state !== "running") return;

    const duration = 0.4;
    const length = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * 0.22 * fade;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.07;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  } catch {
    // Autoplay / AudioContext limits — visual crackle still runs.
  }
}
