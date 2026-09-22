import "server-only";

/**
 * Who a row belongs to, decided on the server.
 *
 * is_owner is never taken from the client — Dave's own listening is the one
 * number that has to be trustworthy, since he is on the wall iPad all day and
 * would otherwise be most of the data.
 */

import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import { isPropertyOwner } from "@/lib/photos";
import { isRadioHostName } from "./host";
import { SESSION_KEY_MAX } from "./analytics";

export type IngestContext = {
  isOwner: boolean;
  isPublic: boolean;
  hasUser: boolean;
};

export async function ingestContext(
  request: Request,
  surface: unknown,
): Promise<IngestContext> {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  // The host proves radio.latigocowboy.com; the surface flag catches a
  // signed-out listener on /radio under any other hostname.
  const isPublic = isRadioHostName(host) || surface === "public";

  let isOwner = false;
  let hasUser = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      hasUser = true;
      const propertyId = await getDefaultPropertyIdForUser(user.id);
      isOwner = propertyId
        ? await isPropertyOwner(propertyId, user.id)
        : false;
    }
  } catch {
    // No session to read on the public radio; the row is simply not Dave's.
  }

  return { isOwner, isPublic, hasUser };
}

export function cleanSessionKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().slice(0, SESSION_KEY_MAX);
  return key || null;
}

/** Beacons arrive as a Blob, so never trust the content type. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
