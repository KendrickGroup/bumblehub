-- Optional call letters and frequency for Ranch House Radio presets.

ALTER TABLE public.radio_stations
  ADD COLUMN IF NOT EXISTS call_sign text,
  ADD COLUMN IF NOT EXISTS frequency text;
