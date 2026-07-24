export function parseHomeAssistantUrl(dashboardLayout: unknown): string {
  if (!dashboardLayout || typeof dashboardLayout !== "object") return "";
  const raw = (dashboardLayout as Record<string, unknown>).home_assistant_url;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Normalize HA URL for storage; empty string clears. Throws on invalid. */
export function normalizeHomeAssistantUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL, like http://homeassistant.local:8123");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }

  // Drop trailing slash for consistency (keep path if present)
  const href = url.href.replace(/\/$/, "");
  return href;
}
