-- FM3 is an empty third FM page. Existing stations stay on their bands.

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_band_check;

ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_band_check
  CHECK (band IN ('fm1', 'fm2', 'fm3', 'am'));
