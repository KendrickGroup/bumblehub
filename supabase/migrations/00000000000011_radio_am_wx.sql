-- Merge AM SPORTS into AM. Feed stations stay feed; band is fm|am only.
-- Weather broadcast URL lives in property_settings.dashboard_layout.wx_stream_url.

UPDATE public.radio_stations SET band = 'am' WHERE band = 'sports';

ALTER TABLE public.radio_stations
  DROP CONSTRAINT IF EXISTS radio_stations_band_check;
ALTER TABLE public.radio_stations
  ADD CONSTRAINT radio_stations_band_check
  CHECK (band IN ('fm', 'am'));
