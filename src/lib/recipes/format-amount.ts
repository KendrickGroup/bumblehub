const FRACTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: "¼" },
  { value: 0.33, label: "⅓" },
  { value: 0.5, label: "½" },
  { value: 0.75, label: "¾" },
];

function isNear(a: number, b: number, epsilon = 0.02): boolean {
  return Math.abs(a - b) < epsilon;
}

function formatWholeAndFraction(value: number): string {
  const whole = Math.floor(value);
  const frac = value - whole;

  for (const { value: f, label } of FRACTIONS) {
    if (isNear(frac, f)) {
      return whole > 0 ? `${whole}${label}` : label;
    }
  }

  const trimmed = Number.parseFloat(value.toFixed(2));
  const asString = String(trimmed);
  return asString.includes(".") ? asString.replace(/\.?0+$/, "") : asString;
}

/** Format a scaled ingredient amount for display. */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "0";
  if (amount === 0) return "0";

  if (amount < 1) {
    for (const { value, label } of FRACTIONS) {
      if (isNear(amount, value)) return label;
    }
    return formatWholeAndFraction(amount);
  }

  const whole = Math.floor(amount);
  const frac = amount - whole;
  if (frac < 0.01) return String(whole);

  for (const { value, label } of FRACTIONS) {
    if (isNear(frac, value)) {
      return whole > 0 ? `${whole}${label}` : label;
    }
  }

  return formatWholeAndFraction(amount);
}

export function scaleAmount(
  baseAmount: number,
  currentServings: number,
  baseServings: number,
): number {
  if (baseServings <= 0) return baseAmount;
  return (baseAmount * currentServings) / baseServings;
}

export function formatIngredientAmount(
  amount: number,
  unit: string | null,
): string {
  const formatted = formatAmount(amount);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatIngredientLine(
  name: string,
  amount: number,
  unit: string | null,
): string {
  const line = formatIngredientAmount(amount, unit);
  return unit ? `${line} ${name}` : `${line} ${name}`;
}
