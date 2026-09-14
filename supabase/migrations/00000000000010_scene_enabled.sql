-- Home screen scene visibility. Existing scenes stay shown.

ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;
