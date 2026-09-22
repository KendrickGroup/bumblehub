-- The Latigo List: people who asked to hear from the ranch.
--
-- Written only by /api/radio/subscribe on the service key. RLS is on with no
-- policies, so anon and authenticated can neither read the list nor add to it.
-- Klaviyo is the real mailing list; this table is the receipt, so a Klaviyo
-- outage never loses an address — the sync can be replayed from here.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.radio_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- citext so Dave@ and dave@ are one person, not two.
  email citext NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'latigo_radio',
  station_call text,
  is_pwa boolean NOT NULL DEFAULT false,
  user_agent text,
  klaviyo_synced boolean NOT NULL DEFAULT false,
  klaviyo_synced_at timestamptz,
  klaviyo_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radio_subscribers_created_at_idx
  ON public.radio_subscribers (created_at DESC);

ALTER TABLE public.radio_subscribers ENABLE ROW LEVEL SECURITY;
