-- Bands, feed stations, and map/time metadata for Ranch House Radio.

ALTER TABLE public.radio_stations
  ADD COLUMN IF NOT EXISTS band text NOT NULL DEFAULT 'fm',
  ADD COLUMN IF NOT EXISTS station_type text NOT NULL DEFAULT 'stream',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS timezone text;

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_band_check;
ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_band_check
  CHECK (band IN ('fm', 'am', 'sports'));

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_station_type_check;
ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_station_type_check
  CHECK (station_type IN ('stream', 'feed'));

-- WSM is the AM home of the Opry; everything else currently on the dial is FM.
UPDATE public.radio_stations
SET band = 'am'
WHERE upper(coalesce(call_sign, '')) = 'WSM'
   OR upper(coalesce(frequency, '')) ~ '^[0-9]{3,4}([[:space:]]*AM)?$';

UPDATE public.radio_stations SET band = 'fm' WHERE band IS NULL OR band NOT IN ('fm', 'am', 'sports');

UPDATE public.radio_stations SET
  latitude = 32.75, longitude = -97.33, state_code = 'TX', timezone = 'America/Chicago'
WHERE upper(coalesce(call_sign, '')) = 'KFWR';

UPDATE public.radio_stations SET
  latitude = 30.27, longitude = -97.74, state_code = 'TX', timezone = 'America/Chicago'
WHERE upper(coalesce(call_sign, '')) = 'KOKE';

UPDATE public.radio_stations SET
  latitude = 30.07, longitude = -81.86, state_code = 'FL', timezone = 'America/New_York'
WHERE upper(coalesce(call_sign, '')) = 'WGNE';

UPDATE public.radio_stations SET
  latitude = 30.27, longitude = -98.87, state_code = 'TX', timezone = 'America/Chicago'
WHERE upper(coalesce(call_sign, '')) = 'KNAF';

UPDATE public.radio_stations SET
  latitude = 36.16, longitude = -86.78, state_code = 'TN', timezone = 'America/Chicago'
WHERE upper(coalesce(call_sign, '')) = 'WSM';

UPDATE public.radio_stations SET
  latitude = 41.21, longitude = -79.38, state_code = 'PA', timezone = 'America/New_York'
WHERE upper(coalesce(call_sign, '')) = 'WWCH';

UPDATE public.radio_stations SET
  latitude = 35.32, longitude = -87.76, state_code = 'TN', timezone = 'America/Chicago'
WHERE upper(coalesce(call_sign, '')) = 'WWON';

UPDATE public.radio_stations SET
  latitude = 36.23, longitude = -93.11, state_code = 'AR', timezone = 'America/Chicago'
WHERE upper(coalesce(call_sign, '')) = 'KHOZ';

-- Classic baseball archive (Fourble public-domain RSS). One per hive.
INSERT INTO public.radio_stations (
  property_id,
  city_label,
  station_name,
  stream_url,
  display_order,
  is_visible,
  call_sign,
  frequency,
  band,
  station_type,
  timezone
)
SELECT
  p.id,
  'From the Archive',
  'Classic Baseball',
  'https://fourble.co.uk/cbotrarchive-240101-1.rss',
  100,
  true,
  'BASEBALL',
  'CLASSIC',
  'sports',
  'feed',
  'America/New_York'
FROM public.properties p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.radio_stations rs
  WHERE rs.property_id = p.id
    AND rs.station_type = 'feed'
    AND upper(coalesce(rs.call_sign, '')) = 'BASEBALL'
);
