import type { PlaybackCommand } from "./types";

export function parsePlaybackCommand(body: unknown): PlaybackCommand | null {
  if (!body || typeof body !== "object") return null;

  const { command } = body as { command?: string };
  switch (command) {
    case "play":
    case "pause":
    case "next":
    case "previous":
      return { command };
    case "setVolume": {
      const volume = (body as { volume?: unknown }).volume;
      if (typeof volume !== "number" || volume < 0 || volume > 100) return null;
      return { command: "setVolume", volume: Math.round(volume) };
    }
    case "setShuffle": {
      const shuffle = (body as { shuffle?: unknown }).shuffle;
      if (typeof shuffle !== "boolean") return null;
      return { command: "setShuffle", shuffle };
    }
    default:
      return null;
  }
}
