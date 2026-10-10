import { PUBLIC_RADIO_URL } from "./ranch";

/** The one line Dave can reword. Share sends this plus the radio link. */
export const RADIO_SHARE_TEXT =
  "Check out Latigo Radio, free country radio from the ranch.";

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function copyLatigoLink(): Promise<"copied" | "failed"> {
  try {
    await navigator.clipboard.writeText(
      `${RADIO_SHARE_TEXT}\n${PUBLIC_RADIO_URL}`,
    );
    return "copied";
  } catch {
    return "failed";
  }
}

export async function shareLatigo(): Promise<
  "shared" | "copied" | "cancelled" | "failed"
> {
  if (canNativeShare()) {
    try {
      await navigator.share({
        text: RADIO_SHARE_TEXT,
        url: PUBLIC_RADIO_URL,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  return copyLatigoLink();
}
