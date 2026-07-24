import type { StructuredRecipe } from "./types";

const STRUCTURE_SYSTEM = `You convert messy recipe text into a single JSON object for a home cook tablet app.
Return STRICT JSON only — no prose, no markdown, no code fences.

Shape:
{
  "title": string,
  "description": string|null,
  "servings": number,
  "prep_minutes": number|null,
  "cook_minutes": number|null,
  "total_minutes": number|null,
  "tags": string[],
  "ingredients": [ { "name": string, "amount": number|null, "unit": string|null, "notes": string|null } ],
  "steps": [ { "title": string, "content": string, "timer_seconds": number|null } ]
}

Rules:
- Preserve the recipe's real quantities. Convert ranges to the midpoint (e.g. 2–3 → 2.5).
- Default servings to 4 if not stated.
- tags: 2–5 short sensible tags (lowercase).
- Step title: 2–4 word gerund when possible (e.g. "Searing", "Building braise").
- Step content: complete enough to cook from; keep important detail.
- timer_seconds: only for waits/cooks with a clear duration; otherwise null. Convert minutes to seconds.
- description: one short sentence or null.
- Do not invent major ingredients that aren't in the source.`;

export function structureSystemPrompt(): string {
  return STRUCTURE_SYSTEM;
}

function stripCodeFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return text.trim();
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

export function parseStructuredRecipe(raw: string): StructuredRecipe {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("Response was not valid JSON");
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Response was not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  const title = asString(obj.title);
  if (!title) throw new Error("Missing recipe title");

  const ingredientsRaw = Array.isArray(obj.ingredients) ? obj.ingredients : [];
  const stepsRaw = Array.isArray(obj.steps) ? obj.steps : [];
  if (ingredientsRaw.length === 0) throw new Error("No ingredients found");
  if (stepsRaw.length === 0) throw new Error("No steps found");

  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  let servings = asNullableNumber(obj.servings) ?? 4;
  servings = Math.max(1, Math.min(99, Math.round(servings)));

  const ingredients = ingredientsRaw.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const name = asString(r.name);
    if (!name) throw new Error("Ingredient missing name");
    return {
      name,
      amount: asNullableNumber(r.amount),
      unit: asString(r.unit) || null,
      notes: asString(r.notes) || null,
    };
  });

  const steps = stepsRaw.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const content = asString(r.content);
    if (!content) throw new Error("Step missing content");
    const timer = asNullableNumber(r.timer_seconds);
    return {
      title: asString(r.title) || "Step",
      content,
      timer_seconds:
        timer != null && timer > 0 ? Math.round(timer) : null,
    };
  });

  return {
    title,
    description: asString(obj.description) || null,
    servings,
    prep_minutes: asNullableNumber(obj.prep_minutes),
    cook_minutes: asNullableNumber(obj.cook_minutes),
    total_minutes: asNullableNumber(obj.total_minutes),
    tags: tags.length > 0 ? tags : ["homemade"],
    ingredients,
    steps,
  };
}
