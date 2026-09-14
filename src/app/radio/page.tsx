"use client";

import { RadioDial } from "@/components/music/RadioDial";

export default function PublicRadioPage() {
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#FAF8F3] px-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] max-sm:px-[max(8px,env(safe-area-inset-left))] max-sm:pr-[max(8px,env(safe-area-inset-right))] max-sm:pt-[max(8px,env(safe-area-inset-top))] max-sm:pb-[max(8px,env(safe-area-inset-bottom))]">
      <RadioDial publicMode />
    </main>
  );
}
