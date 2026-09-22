-- What people actually listen to, and which shirts pull.
--
-- Both tables are write-only from the API route on the service key: RLS is on
-- with no policies at all, so anon and authenticated read nothing even through
-- the aggregate functions below (those run with invoker rights on purpose).
--
-- Nothing here identifies a person. No IP, no user agent, no user id.
-- session_key is a random per-browser-session string, kept only so ten tunes in
-- one sitting can be told apart from ten different people.

CREATE TABLE IF NOT EXISTS public.station_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_call text NOT NULL,
  station_id text,
  band text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  seconds integer NOT NULL DEFAULT 0,
  is_owner boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  session_key text,
  -- A play is 10s of real playback; a radio left on all night caps at 4h.
  CONSTRAINT station_plays_seconds_range CHECK (seconds >= 0 AND seconds <= 14400),
  CONSTRAINT station_plays_band_check CHECK (band IN ('fm', 'am', 'sports', 'wx'))
);

CREATE INDEX IF NOT EXISTS station_plays_started_at_idx
  ON public.station_plays (started_at DESC);
CREATE INDEX IF NOT EXISTS station_plays_station_call_idx
  ON public.station_plays (station_call);

ALTER TABLE public.station_plays ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.banner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_handle text NOT NULL,
  product_title text,
  kind text NOT NULL,
  station_call text,
  is_owner boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,
  session_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banner_events_kind_check
    CHECK (kind IN ('impression', 'expand', 'buy'))
);

CREATE INDEX IF NOT EXISTS banner_events_created_at_idx
  ON public.banner_events (created_at DESC);
CREATE INDEX IF NOT EXISTS banner_events_product_handle_idx
  ON public.banner_events (product_handle);

ALTER TABLE public.banner_events ENABLE ROW LEVEL SECURITY;

-- Ranked by total listening time, not play count: a station people tap and
-- abandon is not popular. frequency is joined live so the dial label reads
-- right, and left-joined so a deleted station keeps its history.
CREATE OR REPLACE FUNCTION public.station_play_totals(
  since timestamptz,
  include_owner boolean
)
RETURNS TABLE (
  station_call text,
  station_id text,
  band text,
  frequency text,
  station_name text,
  plays bigint,
  seconds bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.station_call,
    p.station_id,
    max(p.band) AS band,
    max(s.frequency) AS frequency,
    max(s.station_name) AS station_name,
    count(*) AS plays,
    sum(p.seconds)::bigint AS seconds
  FROM public.station_plays p
  LEFT JOIN public.radio_stations s ON s.id::text = p.station_id
  WHERE p.started_at >= since
    AND (include_owner OR NOT p.is_owner)
  GROUP BY p.station_call, p.station_id
  ORDER BY sum(p.seconds) DESC, count(*) DESC;
$$;

-- One row per product with the three counts side by side. The title is the most
-- recent one Shopify gave us, so a renamed product still reads right.
CREATE OR REPLACE FUNCTION public.banner_product_totals(
  since timestamptz,
  include_owner boolean
)
RETURNS TABLE (
  product_handle text,
  product_title text,
  impressions bigint,
  expands bigint,
  buys bigint,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.product_handle,
    (array_agg(e.product_title ORDER BY e.created_at DESC)
      FILTER (WHERE e.product_title IS NOT NULL))[1] AS product_title,
    count(*) FILTER (WHERE e.kind = 'impression') AS impressions,
    count(*) FILTER (WHERE e.kind = 'expand') AS expands,
    count(*) FILTER (WHERE e.kind = 'buy') AS buys,
    max(e.created_at) AS last_seen
  FROM public.banner_events e
  WHERE e.created_at >= since
    AND (include_owner OR NOT e.is_owner)
  GROUP BY e.product_handle;
$$;

REVOKE EXECUTE ON FUNCTION public.station_play_totals(timestamptz, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.banner_product_totals(timestamptz, boolean) FROM PUBLIC;
