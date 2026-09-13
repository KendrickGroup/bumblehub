"use client";

import { RadioDial } from "@/components/music/RadioDial";

export default function PublicRadioPage() {
  return (
    <main className="min-h-dvh bg-[#FAF8F3] px-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <RadioDial publicMode />
    </main>
  );
}
