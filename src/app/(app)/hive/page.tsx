import type { Metadata } from "next";
import { StubPage } from "@/components/shell/StubPage";

export const metadata: Metadata = {
  title: "Hive",
};

export default function HivePage() {
  return (
    <StubPage
      title="Hive"
      description="Guestbook, photos, and family features will gather here."
    />
  );
}
