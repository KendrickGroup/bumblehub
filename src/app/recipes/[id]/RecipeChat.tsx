"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { insertRecipeChatMessage } from "../actions";
import type { RecipeChatMessage } from "@/lib/recipes/types";

type Props = {
  recipeId: string;
  initialMessages: RecipeChatMessage[];
  firstIngredientName: string;
  /** When true, render as a bottom sheet (mobile). */
  sheet?: boolean;
  open?: boolean;
  onClose?: () => void;
};

export function RecipeChat({
  recipeId,
  initialMessages,
  firstIngredientName,
  sheet = false,
  open = true,
  onClose,
}: Props) {
  const [messages, setMessages] =
    useState<RecipeChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  const suggestions = [
    `What can I substitute for ${firstIngredientName}?`,
    "Can I do this in a slow cooker?",
    "What sides would work?",
  ];

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setInput("");
    setStreaming("");

    const optimistic: RecipeChatMessage = {
      id: `temp-${Date.now()}`,
      recipe_id: recipeId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const insertResult = await insertRecipeChatMessage(
      recipeId,
      "user",
      trimmed,
    );
    if (!insertResult.ok) {
      setError(insertResult.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBusy(false);
      return;
    }

    if (insertResult.id) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, id: insertResult.id! } : m,
        ),
      );
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(errBody || "Chat request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setStreaming(assistantText);
      }

      const finalText = assistantText.trim();
      if (finalText) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            recipe_id: recipeId,
            role: "assistant",
            content: finalText,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setStreaming("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStreaming("");
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <div
      className={`flex flex-col bg-white ${
        sheet
          ? "h-[min(85vh,640px)] rounded-t-[24px] shadow-2xl"
          : "h-full min-h-[420px] rounded-[20px] border border-stone-200/80 shadow-sm lg:min-h-0"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-5 w-5 text-[#F4B400]"
            strokeWidth={1.75}
            aria-hidden
          />
          <h2 className="text-base font-semibold text-stone-900">
            Ask about this recipe
          </h2>
        </div>
        {sheet && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[92%] whitespace-pre-wrap rounded-[16px] px-4 py-3 text-[15px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-stone-100 text-stone-900"
                  : "bg-[#FBF0D0] text-stone-900"
              }`}
            >
              {msg.content}
            </p>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <p className="max-w-[92%] whitespace-pre-wrap rounded-[16px] bg-[#FBF0D0] px-4 py-3 text-[15px] leading-relaxed text-stone-900">
              {streaming}
              <span className="ml-0.5 inline-block animate-pulse">▍</span>
            </p>
          </div>
        )}
        {busy && !streaming && (
          <p className="text-center text-sm text-stone-500">Thinking…</p>
        )}
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="border-t border-stone-100 px-4 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => setInput(chip)}
              className="rounded-full border border-stone-200 bg-[#FAF8F3] px-3 py-2 text-left text-xs font-medium text-stone-700 transition hover:border-[#F4B400]/50 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a cooking question…"
            disabled={busy}
            className="min-h-[52px] flex-1 rounded-[18px] border border-stone-200 bg-white px-4 text-base focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800 disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );

  if (sheet) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end min-[900px]:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-stone-900/40"
          aria-label="Close chat overlay"
          onClick={onClose}
        />
        <div className="relative">{panel}</div>
      </div>
    );
  }

  return panel;
}
