import { createClient } from "@/lib/supabase/server";
import type { RopedSong } from "./types";
import { ROPED_SONG_COLUMNS } from "./types";

export async function listRopedSongs(
  propertyId: string,
): Promise<RopedSong[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roped_songs")
    .select(ROPED_SONG_COLUMNS)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.info(
      JSON.stringify({
        msg: "roundup.list.failure",
        propertyId,
        error: error.message,
      }),
    );
    return [];
  }
  return (data as RopedSong[] | null) ?? [];
}

export async function deleteRopedSong(
  propertyId: string,
  songId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("roped_songs")
    .delete()
    .eq("id", songId)
    .eq("property_id", propertyId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
