import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { fetchRecipeChats, fetchRecipeDetail } from "@/lib/recipes/queries";
import { buildRecipeSystemPrompt } from "@/lib/recipes/system-prompt";

const CHAT_MODEL =
  process.env.ANTHROPIC_RECIPE_MODEL ?? "claude-opus-4-5";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await context.params;

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

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 503 },
    );
  }

  const recipe = await fetchRecipeDetail(recipeId, propertyId);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const history = await fetchRecipeChats(recipeId);
  const anthropicMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (
    anthropicMessages.length === 0 ||
    anthropicMessages[anthropicMessages.length - 1]?.role !== "user" ||
    anthropicMessages[anthropicMessages.length - 1]?.content !== message
  ) {
    anthropicMessages.push({ role: "user", content: message });
  }

  const anthropic = new Anthropic({ apiKey });
  const stream = anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system: buildRecipeSystemPrompt(recipe),
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  let fullText = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        stream.on("text", (delta) => {
          fullText += delta;
          controller.enqueue(encoder.encode(delta));
        });
        await stream.finalMessage();

        if (fullText.trim()) {
          await supabase.from("recipe_chats").insert({
            recipe_id: recipeId,
            role: "assistant",
            content: fullText.trim(),
          });
        }

        controller.close();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Chat stream failed";
        controller.error(new Error(msg));
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
