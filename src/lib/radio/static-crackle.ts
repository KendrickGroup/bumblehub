/** Brief analog-radio static burst on retune. */
export function playStaticCrackle() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const duration = 0.4;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * 0.22 * fade;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    source.connect(gain);
    gain.connect(ctx.destination);
    void ctx.resume();
    source.start();
    source.onended = () => {
      void ctx.close();
    };
  } catch {
    // Autoplay / AudioContext limits — visual crackle still runs.
  }
}
