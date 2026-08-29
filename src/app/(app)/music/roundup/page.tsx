import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import { listRopedSongs } from "@/lib/roundup/queries";
import { RoundupList } from "@/components/music/RoundupList";
import { RoundupRopeMark } from "@/components/music/AudioSourceMarks";

export const metadata: Metadata = {
  title: "The Roundup",
};

export default async function RoundupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = user
    ? await getDefaultPropertyIdForUser(user.id)
    : null;
  const songs = propertyId ? await listRopedSongs(propertyId) : [];
  const owner =
    user && propertyId ? await isPropertyOwner(propertyId, user.id) : false;

  return (
    <div className="mx-auto w-full max-w-[720px] pb-4">
      <Link
        href="/music"
        className="inline-flex min-h-[44px] items-center font-[family-name:var(--font-elite)] text-sm text-[#8A6F45] transition hover:text-[#3E2A1E]"
      >
        ← Ranch House Radio
      </Link>

      <header className="mt-4 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-[#C9A24B]">
          <RoundupRopeMark size={22} />
        </div>
        <h1 className="font-[family-name:var(--font-rye)] text-[28px] tracking-[0.08em] text-[#C9A24B] [text-shadow:0_1px_0_rgba(0,0,0,.12)] sm:text-[32px]">
          The Roundup
        </h1>
        <p className="mt-2 font-[family-name:var(--font-elite)] text-[14px] text-[#6B5636]">
          Songs roped off the Ranch House Radio
        </p>
      </header>

      <RoundupList songs={songs} isOwner={owner} />
    </div>
  );
}
