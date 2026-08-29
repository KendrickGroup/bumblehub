import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultPropertyIdForUser,
  userIsPropertyMember,
} from "@/lib/property";

export async function requireHiveMember(): Promise<
  { userId: string; propertyId: string } | { response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) {
    return {
      response: NextResponse.json(
        { error: "No default property configured" },
        { status: 400 },
      ),
    };
  }

  const member = await userIsPropertyMember(propertyId, user.id);
  if (!member) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId: user.id, propertyId };
}
