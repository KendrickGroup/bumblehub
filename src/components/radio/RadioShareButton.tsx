"use client";

import { useState } from "react";
import { copyLatigoLink, shareLatigo } from "@/lib/radio/share";

export function RadioShareButton({
  className,
  label = "Share",
  mode = "share",
}: {
  className?: string;
  label?: string;
  mode?: "share" | "copy";
}) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const run = mode === "copy" ? copyLatigoLink() : shareLatigo();
        void run.then((result) => {
          if (result === "copied") setNote("Copied");
          else if (result === "failed") setNote("Couldn't copy");
          else return;
          window.setTimeout(() => setNote(null), 1600);
        });
      }}
    >
      {note ?? label}
    </button>
  );
}
