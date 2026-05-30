import type { Metadata } from "next";
import Link from "next/link";
import { StubPage } from "@/components/shell/StubPage";

export const metadata: Metadata = {
  title: "Hive",
};

export default function HivePage() {
  return (
    <div>
      <StubPage
        title="Hive"
        description="Guestbook, photos, and family features will gather here."
      />
      <p className="mt-4 px-2 text-sm text-stone-600 sm:px-0">
        <Link
          href="/guestbook"
          className="font-medium text-[#b8860b] underline-offset-2 hover:underline"
        >
          Add a guestbook photo
        </Link>{" "}
        in the meantime.
      </p>
    </div>
  );
}
