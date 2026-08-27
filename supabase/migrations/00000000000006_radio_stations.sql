-- Per-hive internet radio stations for the /music dial

CREATE TABLE IF NOT EXISTS public.radio_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  city_label text NOT NULL,
  station_name text NOT NULL,
  stream_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radio_stations_https_url CHECK (stream_url LIKE 'https://%')
);

CREATE INDEX IF NOT EXISTS radio_stations_property_order_idx
  ON public.radio_stations (property_id, display_order);

ALTER TABLE public.radio_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radio_stations member select"
ON public.radio_stations
FOR SELECT
TO authenticated
USING (is_property_member(property_id));

CREATE POLICY "radio_stations member insert"
ON public.radio_stations
FOR INSERT
TO authenticated
WITH CHECK (is_property_member(property_id));

CREATE POLICY "radio_stations member update"
ON public.radio_stations
FOR UPDATE
TO authenticated
USING (is_property_member(property_id))
WITH CHECK (is_property_member(property_id));

CREATE POLICY "radio_stations member delete"
ON public.radio_stations
FOR DELETE
TO authenticated
USING (is_property_member(property_id));

-- Seed the 8 launch stations for every existing hive that has none yet.
INSERT INTO public.radio_stations (
  property_id,
  city_label,
  station_name,
  stream_url,
  display_order,
  is_visible
)
SELECT
  p.id,
  s.city_label,
  s.station_name,
  s.stream_url,
  s.display_order,
  true
FROM public.properties p
CROSS JOIN (
  VALUES
    ('Seattle', 'KEXP 90.3', 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', 0),
    ('Portland', 'KBOO 90.7', 'https://listen.kboo.fm/high', 1),
    ('San Francisco', 'KQED', 'https://streams.kqed.org/kqedradio', 2),
    ('Los Angeles', 'KCRW', 'https://kcrw.streamguys1.com/kcrw_192k_mp3_on_air', 3),
    ('Austin', 'KUTX 98.9', 'https://kut.streamguys1.com/kutx-web', 4),
    ('New Orleans', 'WWOZ 90.7', 'https://wwoz-sc.streamguys1.com/wwoz-hi', 5),
    ('Chicago', 'WBEZ 91.5', 'https://stream.wbez.org/wbez64-web.aac', 6),
    ('New York', 'WNYC 93.9', 'https://fm939.wnyc.org/wnycfm-web', 7)
) AS s(city_label, station_name, stream_url, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.radio_stations rs WHERE rs.property_id = p.id
);
