-- Latigo take-home portraits: public share token + cabinet-card image URL
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS watermarked_url text;

CREATE UNIQUE INDEX IF NOT EXISTS photos_share_token_uidx
  ON public.photos (share_token)
  WHERE share_token IS NOT NULL;

-- Public read of shared cabinet cards (anon select by token via server uses service role;
-- keep RLS strict; public page uses service client).
