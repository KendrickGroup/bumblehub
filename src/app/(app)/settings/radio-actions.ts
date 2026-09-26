"use server";

import { createClient } from "@/lib/supabase/server";
import { getDefaultPropertyIdForUser } from "@/lib/property";
import {
  RADIO_STATION_COLUMNS,
  isHttpsStreamUrl,
  normalizeRadioStation,
  type RadioStation,
} from "@/lib/radio/types";
import { parseCallAndFreq } from "@/lib/radio/parse-identity";
import { countVisibleStations, fetchRadioStations } from "@/lib/radio/queries";
import {
  parseRadioBand,
  stateCodeFromLabel,
  timezoneFromStateCode,
  visibleCapForBand,
  type RadioBand,
  type RadioStationType,
} from "@/lib/radio/ranch";

export type RadioActionResult =
  | { ok: true; station: RadioStation }
  | { ok: true; stations: RadioStation[] }
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

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function emptyToNull(
  value: string | undefined,
  max: number,
): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const clipped = clip(value, max);
  return clipped.length > 0 ? clipped : null;
}

function parseBand(value: unknown): RadioBand | undefined {
  return parseRadioBand(value);
}

function parseStationType(value: unknown): RadioStationType | undefined {
  if (value === "stream" || value === "feed") return value;
  return undefined;
}

function parseCoord(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function createRadioStation(input: {
  city_label: string;
  station_name: string;
  stream_url: string;
  is_visible?: boolean;
  call_sign?: string;
  frequency?: string;
  band?: RadioBand;
  station_type?: RadioStationType;
  latitude?: number | null;
  longitude?: number | null;
  state_code?: string | null;
  timezone?: string | null;
}): Promise<RadioActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const city_label = clip(input.city_label, 40);
  const station_name = clip(input.station_name, 80);
  const stream_url = clip(input.stream_url, 500);

  if (!city_label) return { ok: false, error: "City label is required." };
  if (!station_name) return { ok: false, error: "Station name is required." };
  if (!isHttpsStreamUrl(stream_url)) {
    return { ok: false, error: "Stream URL must start with https://." };
  }

  const parsed = parseCallAndFreq(station_name);
  const call_sign =
    emptyToNull(input.call_sign, 12) ?? parsed.callSign;
  const frequency =
    emptyToNull(input.frequency, 12) ?? parsed.frequency;
  const band: RadioBand =
    parseBand(input.band) ??
    (frequency && !frequency.includes(".") && Number(frequency) >= 530
      ? "am"
      : "fm1");
  const station_type: RadioStationType =
    parseStationType(input.station_type) ?? "stream";
  const state_code =
    emptyToNull(input.state_code ?? undefined, 2) ??
    stateCodeFromLabel(city_label);
  const timezone =
    emptyToNull(input.timezone ?? undefined, 64) ??
    timezoneFromStateCode(state_code);

  const visibleCount = await countVisibleStations(ctx.propertyId, band);
  const wantVisible = input.is_visible !== false;
  const is_visible = wantVisible && visibleCount < visibleCapForBand(band);

  const { data: maxRow } = await ctx.supabase
    .from("radio_stations")
    .select("display_order")
    .eq("property_id", ctx.propertyId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.display_order ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from("radio_stations")
    .insert({
      property_id: ctx.propertyId,
      city_label,
      station_name,
      stream_url,
      display_order: nextOrder,
      is_visible,
      call_sign,
      frequency,
      band,
      station_type,
      latitude: parseCoord(input.latitude) ?? null,
      longitude: parseCoord(input.longitude) ?? null,
      state_code,
      timezone,
    })
    .select(RADIO_STATION_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not add station." };
  }
  return { ok: true, station: normalizeRadioStation(data as RadioStation) };
}

export async function updateRadioStation(input: {
  id: string;
  city_label?: string;
  station_name?: string;
  stream_url?: string;
  is_visible?: boolean;
  call_sign?: string;
  frequency?: string;
  band?: RadioBand;
  station_type?: RadioStationType;
  latitude?: number | null;
  longitude?: number | null;
  state_code?: string | null;
  timezone?: string | null;
}): Promise<RadioActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const patch: Record<string, unknown> = {};

  if (typeof input.city_label === "string") {
    const city_label = clip(input.city_label, 40);
    if (!city_label) return { ok: false, error: "City label is required." };
    patch.city_label = city_label;
  }
  if (typeof input.station_name === "string") {
    const station_name = clip(input.station_name, 80);
    if (!station_name) return { ok: false, error: "Station name is required." };
    patch.station_name = station_name;
  }
  if (typeof input.stream_url === "string") {
    const stream_url = clip(input.stream_url, 500);
    if (!isHttpsStreamUrl(stream_url)) {
      return { ok: false, error: "Stream URL must start with https://." };
    }
    patch.stream_url = stream_url;
  }
  if (typeof input.call_sign === "string") {
    patch.call_sign = emptyToNull(input.call_sign, 12);
  }
  if (typeof input.frequency === "string") {
    patch.frequency = emptyToNull(input.frequency, 12);
  }
  const nextBand = parseBand(input.band);
  if (nextBand) {
    const { data: current } = await ctx.supabase
      .from("radio_stations")
      .select("is_visible, band")
      .eq("id", input.id)
      .eq("property_id", ctx.propertyId)
      .maybeSingle();
    const currentBand = parseRadioBand(current?.band);
    if (
      current?.is_visible &&
      currentBand &&
      currentBand !== nextBand
    ) {
      const visibleCount = await countVisibleStations(
        ctx.propertyId,
        nextBand,
      );
      if (visibleCount >= visibleCapForBand(nextBand)) {
        return {
          ok: false,
          error: "This band is full — hide one to add another.",
        };
      }
    }
    patch.band = nextBand;
  }
  const nextType = parseStationType(input.station_type);
  if (nextType) patch.station_type = nextType;
  if (input.latitude !== undefined) patch.latitude = parseCoord(input.latitude);
  if (input.longitude !== undefined) {
    patch.longitude = parseCoord(input.longitude);
  }
  if (input.state_code !== undefined) {
    patch.state_code = emptyToNull(input.state_code ?? "", 2);
  }
  if (input.timezone !== undefined) {
    patch.timezone = emptyToNull(input.timezone ?? "", 64);
  }
  if (typeof input.is_visible === "boolean") {
    if (input.is_visible) {
      const { data: current } = await ctx.supabase
        .from("radio_stations")
        .select("is_visible, band")
        .eq("id", input.id)
        .eq("property_id", ctx.propertyId)
        .maybeSingle();
      if (!current?.is_visible) {
        const capBand =
          nextBand ?? parseRadioBand(current?.band) ?? "fm1";
        const visibleCount = await countVisibleStations(
          ctx.propertyId,
          capBand,
        );
        if (visibleCount >= visibleCapForBand(capBand)) {
          return {
            ok: false,
            error: "This band is full — hide one to add another.",
          };
        }
      }
    }
    patch.is_visible = input.is_visible;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { data, error } = await ctx.supabase
    .from("radio_stations")
    .update(patch)
    .eq("id", input.id)
    .eq("property_id", ctx.propertyId)
    .select(RADIO_STATION_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save station." };
  }
  return { ok: true, station: normalizeRadioStation(data as RadioStation) };
}

export async function deleteRadioStation(
  id: string,
): Promise<RadioActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("radio_stations")
    .delete()
    .eq("id", id)
    .eq("property_id", ctx.propertyId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderRadioStations(
  orderedIds: string[],
): Promise<RadioActionResult> {
  const ctx = await requireProperty();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const { error } = await ctx.supabase
      .from("radio_stations")
      .update({ display_order: i })
      .eq("id", id)
      .eq("property_id", ctx.propertyId);
    if (error) return { ok: false, error: error.message };
  }

  const stations = await fetchRadioStations(ctx.propertyId);
  return { ok: true, stations };
}
