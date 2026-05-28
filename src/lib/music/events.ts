export const MUSIC_UPDATED_EVENT = "bumblehub:music-updated";

export function notifyMusicUpdated() {
  window.dispatchEvent(new CustomEvent(MUSIC_UPDATED_EVENT));
}
