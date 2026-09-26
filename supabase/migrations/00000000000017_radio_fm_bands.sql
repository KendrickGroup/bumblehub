-- Split FM into FM1 and FM2 so the preset grid can breathe. First four FM
-- stations in current display order land on fm1, the rest on fm2. Order is
-- not shuffled. AM is unchanged.

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_band_check;

ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_band_check
  CHECK (band IN ('fm', 'fm1', 'fm2', 'am'));

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY property_id
      ORDER BY display_order ASC, created_at ASC, id ASC
    ) AS rn
  FROM public.radio_stations
  WHERE band IN ('fm', 'fm1')
)
UPDATE public.radio_stations AS s
SET band = CASE WHEN ranked.rn <= 4 THEN 'fm1' ELSE 'fm2' END
FROM ranked
WHERE s.id = ranked.id;

UPDATE public.radio_stations
SET band = 'fm1'
WHERE band = 'fm';

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_band_check;

ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_band_check
  CHECK (band IN ('fm1', 'fm2', 'am'));
