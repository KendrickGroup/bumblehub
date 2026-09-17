export const RADIO_HOST = (
  process.env.NEXT_PUBLIC_RADIO_HOST ?? "radio.latigocowboy.com"
)
  .trim()
  .toLowerCase();

export const RADIO_ORIGIN = `https://${RADIO_HOST}`;
export const BUMBLEHUB_ORIGIN = "https://bumblehub.dev";

export const RADIO_OG_DESCRIPTION =
  "Country stations pulled in from across the country — live from Latigo Ranch House in Sutter Creek.";

export function hostnameOf(host: string | null | undefined): string {
  const raw = (host ?? "").split(",")[0]?.trim() ?? "";
  return raw.split(":")[0]?.toLowerCase() ?? "";
}

export function isRadioHostName(host: string | null | undefined): boolean {
  return hostnameOf(host) === RADIO_HOST;
}
