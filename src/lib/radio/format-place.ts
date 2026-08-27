const PLACE_SUFFIX: Record<string, string> = {
  seattle: "Seattle, Wash.",
  portland: "Portland, Ore.",
  "san francisco": "San Francisco, Calif.",
  "los angeles": "Los Angeles, Calif.",
  austin: "Austin, Tex.",
  "new orleans": "New Orleans, La.",
  chicago: "Chicago, Ill.",
  "new york": "New York, N.Y.",
  sacramento: "Sacramento, Calif.",
  bakersfield: "Bakersfield, Calif.",
  billings: "Billings, Mont.",
  cheyenne: "Cheyenne, Wyo.",
  amarillo: "Amarillo, Tex.",
  "fort worth": "Fort Worth, Tex.",
  dallas: "Dallas, Tex.",
  nashville: "Nashville, Tenn.",
};

export function formatTunedPlace(cityLabel: string): string {
  const trimmed = cityLabel.trim();
  if (!trimmed) return "the dial";
  if (trimmed.includes(",")) return trimmed;
  return PLACE_SUFFIX[trimmed.toLowerCase()] ?? trimmed;
}
