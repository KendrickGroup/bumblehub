"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Already signed in: leave the form after it has painted. Never blocks first paint. */
export function LoginSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/home");
    });
  }, [router]);

  return null;
}
