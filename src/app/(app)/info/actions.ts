"use server";

import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  STARTER_SECTIONS,
  isInfoIconName,
  type InfoSection,
} from "@/lib/info/types";

export type InfoActionResult =
  | { ok: true; section: InfoSection }
  | { ok: true; sections: InfoSection[] }
  | { ok: true }
  | { ok: false; error: string };

async function requireProperty(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; propertyId: string }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const propertyId = await getDefaultPropertyIdForUser(user.id);
  if (!propertyId) return { error: "No active hive configured." };

  return { supabase, propertyId };
}

function asSection(row: InfoSection): InfoSection {
  return row;
}

export async function fetchInfoSections(
  propertyId: string,
): Promise<InfoSection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("info_sections")
    .select(
      "id, property_id, title, body, icon, display_order, updated_at, created_at",
    )
    .eq("property_id", propertyId)
    .order("display_order", { ascending: true });

  return (data as InfoSection[] | null) ?? [];
}

/** Seed starters when the hive has no sections yet. */
export async function ensureStarterSections(
  propertyId: string,
): Promise<InfoSection[]> {
  const existing = await fetchInfoSections(propertyId);
  if (existing.length > 0) return existing;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("info_sections")
    .insert(
      STARTER_SECTIONS.map((s) => ({
        property_id: propertyId,
        title: s.title,
        body: s.body,
        icon: s.icon,
        display_order: s.display_order,
      })),
    )
    .select(
      "id, property_id, title, body, icon, display_order, updated_at, created_at",
    );

  if (error || !data) return [];
  return data as InfoSection[];
}

export async function createInfoSection(input: {
  title?: string;
  body?: string;
  icon?: string | null;
}): Promise<InfoActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: maxRow } = await ctx.supabase
    .from("info_sections")
    .select("display_order")
    .eq("property_id", ctx.propertyId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.display_order ?? -1) + 1;
  const icon =
    input.icon && isInfoIconName(input.icon) ? input.icon : null;

  const { data, error } = await ctx.supabase
    .from("info_sections")
    .insert({
      property_id: ctx.propertyId,
      title: (input.title?.trim() || "New section").slice(0, 120),
      body: input.body ?? "",
      icon,
      display_order: nextOrder,
    })
    .select(
      "id, property_id, title, body, icon, display_order, updated_at, created_at",
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create section." };
  }
  return { ok: true, section: asSection(data as InfoSection) };
}

export async function updateInfoSection(input: {
  id: string;
  title?: string;
  body?: string;
  icon?: string | null;
}): Promise<InfoActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const patch: Record<string, unknown> = {};
  if (typeof input.title === "string") {
    patch.title = input.title.trim().slice(0, 120) || "Untitled";
  }
  if (typeof input.body === "string") {
    patch.body = input.body;
  }
  if (input.icon === null) {
    patch.icon = null;
  } else if (typeof input.icon === "string") {
    patch.icon = isInfoIconName(input.icon) ? input.icon : null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { data, error } = await ctx.supabase
    .from("info_sections")
    .update(patch)
    .eq("id", input.id)
    .eq("property_id", ctx.propertyId)
    .select(
      "id, property_id, title, body, icon, display_order, updated_at, created_at",
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save section." };
  }
  return { ok: true, section: asSection(data as InfoSection) };
}

export async function deleteInfoSection(id: string): Promise<InfoActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("info_sections")
    .delete()
    .eq("id", id)
    .eq("property_id", ctx.propertyId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderInfoSections(
  orderedIds: string[],
): Promise<InfoActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const { error } = await ctx.supabase
      .from("info_sections")
      .update({ display_order: i })
      .eq("id", id)
      .eq("property_id", ctx.propertyId);
    if (error) return { ok: false, error: error.message };
  }

  const sections = await fetchInfoSections(ctx.propertyId);
  return { ok: true, sections };
}
