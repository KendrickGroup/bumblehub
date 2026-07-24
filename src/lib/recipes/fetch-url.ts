/** Detect a lone URL in the user input. */
export function extractLoneUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return trimmed;
    }
  } catch {
    // not a bare URL
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    try {
      const url = new URL(lines[0]!);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return lines[0]!;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** Basic HTML → readable text (strip scripts/styles/nav-ish chrome). */
export function htmlToReadableText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "");

  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export async function fetchUrlAsText(url: string): Promise<{
  ok: true;
  text: string;
} | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent":
          "BumbleHubRecipeBot/1.0 (+https://bumblehub.dev; recipe import)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Couldn’t open that link (${response.status}). Try pasting the recipe text instead.`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    let text: string;
    if (contentType.includes("text/plain")) {
      text = body.trim();
    } else {
      text = htmlToReadableText(body);
    }

    if (text.length < 200) {
      return {
        ok: false,
        error:
          "That page didn’t give us enough recipe text. Paste the ingredients and steps instead.",
      };
    }

    // Cap very large pages before sending to the model.
    return { ok: true, text: text.slice(0, 40_000) };
  } catch {
    return {
      ok: false,
      error:
        "Couldn’t reach that link. Check the URL, or paste the recipe text instead.",
    };
  }
}
