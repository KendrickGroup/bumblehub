import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { extractLoneUrl, fetchUrlAsText } from "@/lib/recipes/fetch-url";
import {
  parseStructuredRecipe,
  structureSystemPrompt,
} from "@/lib/recipes/structure";

const PRIMARY_MODEL =
  process.env.ANTHROPIC_RECIPE_MODEL ?? "claude-opus-4-5";
const FALLBACK_MODELS = [
  "claude-opus-4-6",
  "claude-opus-4-5",
  "claude-sonnet-4-5",
];

function modelsToTry(): string[] {
  return [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])];
}

function isModelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("model") ||
    msg.includes("not_found") ||
    msg.includes("404") ||
    msg.includes("invalid")
  );
}

async function callStructure(
  anthropic: Anthropic,
  model: string,
  recipeText: string,
  nudge?: string,
): Promise<string> {
  const userContent = nudge
    ? `${nudge}\n\n---\n\n${recipeText}`
    : recipeText;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    system: structureSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
  });

  const parts = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  if (!parts.trim()) {
    throw new Error("Empty model response");
  }
  return parts;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return NextResponse.json({ error: "No property" }, { status: 400 });
  }

  let body: { input?: string };
  try {
    body = (await request.json()) as { input?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body.input?.trim() ?? "";
  if (!input) {
    return NextResponse.json({ error: "Paste a recipe or link first." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 503 },
    );
  }

  let recipeText = input;
  let sourceUrl: string | null = null;
  const loneUrl = extractLoneUrl(input);
  if (loneUrl) {
    const fetched = await fetchUrlAsText(loneUrl);
    if (!fetched.ok) {
      return NextResponse.json({ error: fetched.error }, { status: 422 });
    }
    recipeText = fetched.text;
    sourceUrl = loneUrl;
  }

  const anthropic = new Anthropic({ apiKey });
  const models = modelsToTry();
  let lastError: unknown = null;
  let raw = "";

  for (const model of models) {
    try {
      raw = await callStructure(anthropic, model, recipeText);
      break;
    } catch (error) {
      lastError = error;
      if (!isModelError(error)) break;
    }
  }

  if (!raw) {
    const message =
      lastError instanceof Error
        ? lastError.message
        : "Couldn’t structure that recipe.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    const recipe = parseStructuredRecipe(raw);
    return NextResponse.json({
      recipe: { ...recipe, source_url: sourceUrl },
    });
  } catch {
    // Retry once with a JSON-only nudge on the primary-ish model.
    try {
      const model = models[0]!;
      raw = await callStructure(
        anthropic,
        model,
        recipeText,
        "Your previous reply was invalid. Return ONLY valid JSON matching the required shape — no markdown fences, no commentary.",
      );
      const recipe = parseStructuredRecipe(raw);
      return NextResponse.json({
        recipe: { ...recipe, source_url: sourceUrl },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Couldn’t read the structured recipe.";
      return NextResponse.json(
        {
          error:
            "We had trouble reading that recipe. Try pasting cleaner text, or edit after a simpler paste.",
          detail: message,
        },
        { status: 422 },
      );
    }
  }
}
