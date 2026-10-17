-- Emails collected from the radio's 15% offer.
--
-- Written only by /api/radio/signups on the service key. RLS is on with no
-- policies, so the public radio can add an address and cannot read the list.
-- This is not the Klaviyo list. Export it from the table when the ranch wants it.

create table if not exists public.radio_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  source text,
  constraint radio_signups_email_unique unique (email),
  constraint radio_signups_email_lower check (email = lower(email)),
  constraint radio_signups_email_len check (char_length(email) between 3 and 254)
);

create index if not exists radio_signups_created_at_idx
  on public.radio_signups (created_at desc);

alter table public.radio_signups enable row level security;
