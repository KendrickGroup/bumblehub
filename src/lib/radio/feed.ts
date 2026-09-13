export type RadioFeedEpisode = {
  title: string;
  audioUrl: string;
  pubDate: string | null;
};

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(
    block,
  );
  if (!match?.[1]) return null;
  return decodeXml(match[1].replace(/<[^>]+>/g, " "));
}

function enclosureUrl(block: string): string | null {
  const match = /<enclosure\b[^>]*\burl=["']([^"']+)["']/i.exec(block);
  const url = match?.[1]?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function parseRssFeed(xml: string): RadioFeedEpisode[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const episodes: RadioFeedEpisode[] = [];
  for (const item of items) {
    const audioUrl = enclosureUrl(item);
    if (!audioUrl) continue;
    const title = tagValue(item, "title") || "Archive episode";
    const pubDate = tagValue(item, "pubDate");
    episodes.push({ title, audioUrl, pubDate });
  }
  episodes.sort((a, b) => {
    const da = a.pubDate ? Date.parse(a.pubDate) : 0;
    const db = b.pubDate ? Date.parse(b.pubDate) : 0;
    return db - da;
  });
  return episodes;
}
