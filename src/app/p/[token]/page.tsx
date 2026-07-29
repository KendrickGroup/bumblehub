import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Your Latigo portrait",
};

export default async function PublicPortraitPage({ params }: Props) {
  const { token } = await params;
  const safe = token?.trim() ?? "";

  let watermarkedUrl: string | null = null;
  if (safe.length >= 8) {
    try {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("photos")
        .select("watermarked_url, share_token")
        .eq("share_token", safe)
        .maybeSingle();
      if (data?.watermarked_url) {
        watermarkedUrl = data.watermarked_url as string;
      }
    } catch {
      watermarkedUrl = null;
    }
  }

  if (!watermarkedUrl) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#201A14] px-6 text-center">
        <p className="font-[family-name:var(--font-rye)] text-2xl text-[#F4B400]">
          Latigo Cowboy Portrait Co.
        </p>
        <p className="mt-6 max-w-sm text-base text-[#FAF3E3]/85">
          This portrait isn&apos;t available.
        </p>
        <p className="mt-3 text-sm text-[#D9BE8C]/70">
          Ask the cabin for a fresh QR, partner.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[#201A14] px-4 py-10">
      <p className="mb-6 font-[family-name:var(--font-rye)] text-xl text-[#F4B400] sm:text-2xl">
        Latigo Cowboy Portrait Co.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={watermarkedUrl}
        alt="Your Latigo cabinet-card portrait"
        className="w-full max-w-md rounded-sm shadow-[0_20px_60px_rgba(0,0,0,.55)]"
      />
      <a
        href={watermarkedUrl}
        download="latigo-portrait.jpg"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex min-h-[56px] w-full max-w-md items-center justify-center rounded-[18px] bg-[#F4B400] px-6 text-base font-semibold text-[#3E2A1E]"
      >
        Save your portrait
      </a>
      <p className="mt-3 text-center text-sm text-[#D9BE8C]/80">
        Tip: long-press the image on your phone to save it too.
      </p>
      <p className="mt-10 text-xs tracking-wide text-[#D9BE8C]/55">
        Taken at the cabin · BumbleHub
      </p>
    </main>
  );
}
