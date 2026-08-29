-- Songs lassoed from Ranch House Radio into The Roundup (local, not Spotify playlists).

CREATE TABLE IF NOT EXISTS public.roped_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text,
  artwork_url text,
  spotify_track_id text,
  spotify_track_uri text,
  station_name text,
  station_city text,
  roped_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roped_songs_property_created_idx
  ON public.roped_songs (property_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS roped_songs_property_spotify_track_uidx
  ON public.roped_songs (property_id, spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;

ALTER TABLE public.roped_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roped_songs member select"
ON public.roped_songs
FOR SELECT
TO authenticated
USING (is_property_member(property_id));

CREATE POLICY "roped_songs member insert"
ON public.roped_songs
FOR INSERT
TO authenticated
WITH CHECK (is_property_member(property_id));

CREATE POLICY "roped_songs member update"
ON public.roped_songs
FOR UPDATE
TO authenticated
USING (is_property_member(property_id))
WITH CHECK (is_property_member(property_id));

CREATE POLICY "roped_songs member delete"
ON public.roped_songs
FOR DELETE
TO authenticated
USING (is_property_member(property_id));
