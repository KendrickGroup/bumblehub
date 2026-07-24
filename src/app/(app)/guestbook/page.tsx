import { redirect } from "next/navigation";

/** Legacy capture route — Photo Booth now lives at /hive. */
export default function GuestbookRedirectPage() {
  redirect("/hive");
}
