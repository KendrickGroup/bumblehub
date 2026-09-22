-- Song recognition caches. AudD charges per identification, so these tables
-- sit in front of the call: a repeat of the same messy StreamTitle, or a
-- second listener on the same station, never leaves the house.
--
-- Written only by the now-playing route on the service key. RLS is on with no
-- policies, so anon and authenticated read nothing directly.

CREATE TABLE IF NOT EXISTS public.recognized_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lowercased StreamTitle or "artist title" from a resolved match. Unique so
  -- the same string is one row forever; songs do not change.
  normalized_key text NOT NULL UNIQUE,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  artwork_url text,
  source text NOT NULL DEFAULT 'audd',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recognized_songs_source_check CHECK (source IN ('audd', 'metadata'))
);

CREATE INDEX IF NOT EXISTS recognized_songs_created_at_idx
  ON public.recognized_songs (created_at DESC);

ALTER TABLE public.recognized_songs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.station_now_playing (
  station_call text PRIMARY KEY,
  recognized_song_id uuid REFERENCES public.recognized_songs (id) ON DELETE SET NULL,
  raw_metadata text,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  last_audd_at timestamptz
);

ALTER TABLE public.station_now_playing ENABLE ROW LEVEL SECURITY;

-- One row per calendar month. The guarantee that this cannot bill by surprise.
CREATE TABLE IF NOT EXISTS public.audd_usage (
  month text PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0,
  last_call_at timestamptz,
  CONSTRAINT audd_usage_calls_nonneg CHECK (calls >= 0)
);

ALTER TABLE public.audd_usage ENABLE ROW LEVEL SECURITY;

-- Which stations most often have no usable metadata.
CREATE TABLE IF NOT EXISTS public.audd_station_calls (
  station_call text NOT NULL,
  month text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  last_call_at timestamptz,
  PRIMARY KEY (station_call, month),
  CONSTRAINT audd_station_calls_nonneg CHECK (calls >= 0)
);

ALTER TABLE public.audd_station_calls ENABLE ROW LEVEL SECURITY;

-- Reserve a paid slot. Returns the new month total, or -1 if the ceiling
-- would be crossed. The increment happens here so two lambdas cannot both
-- slip under the limit.
CREATE OR REPLACE FUNCTION public.audd_reserve_call(
  p_month text,
  p_limit integer,
  p_station text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.audd_usage (month, calls, last_call_at)
  VALUES (p_month, 1, now())
  ON CONFLICT (month) DO UPDATE
    SET calls = public.audd_usage.calls + 1,
        last_call_at = now()
    WHERE public.audd_usage.calls < p_limit
  RETURNING calls INTO n;

  IF n IS NULL THEN
    RETURN -1;
  END IF;

  INSERT INTO public.audd_station_calls (station_call, month, calls, last_call_at)
  VALUES (p_station, p_month, 1, now())
  ON CONFLICT (station_call, month) DO UPDATE
    SET calls = public.audd_station_calls.calls + 1,
        last_call_at = now();

  RETURN n;
END;
$$;

-- Mark a station as "a call is in flight / just happened". Returns false when
-- another request already spent the 60-second cooldown.
CREATE OR REPLACE FUNCTION public.audd_try_lock_station(
  p_call text,
  p_cooldown_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  locked boolean;
BEGIN
  INSERT INTO public.station_now_playing (station_call, resolved_at, last_audd_at)
  VALUES (p_call, now(), now())
  ON CONFLICT (station_call) DO UPDATE
    SET last_audd_at = now()
    WHERE public.station_now_playing.last_audd_at IS NULL
       OR public.station_now_playing.last_audd_at
            < now() - make_interval(secs => p_cooldown_seconds)
  RETURNING true INTO locked;

  RETURN COALESCE(locked, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audd_reserve_call(text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audd_try_lock_station(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audd_reserve_call(text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.audd_try_lock_station(text, integer) TO service_role;

-- Cover art we fetched once and keep. Public read; only the service role writes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'song-art',
  'song-art',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "song-art public read" ON storage.objects;
CREATE POLICY "song-art public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'song-art');
