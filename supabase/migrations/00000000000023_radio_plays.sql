/* One anonymous row each time a station starts playing.
   The public radio can insert through the service key. Nobody can read
   the rows except that same key, which the settings page uses. */

create table if not exists public.radio_plays (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  station text not null,
  visitor_id text not null,
  constraint radio_plays_station_len check (char_length(station) between 1 and 80),
  constraint radio_plays_visitor_len check (char_length(visitor_id) between 8 and 80)
);

create index if not exists radio_plays_created_at_idx
  on public.radio_plays (created_at desc);

create index if not exists radio_plays_visitor_id_idx
  on public.radio_plays (visitor_id);

create index if not exists radio_plays_station_idx
  on public.radio_plays (station);

alter table public.radio_plays enable row level security;

create or replace function public.radio_play_summary()
returns table (
  total bigint,
  last_day bigint,
  last_week bigint,
  listeners bigint
)
language sql
stable
as $$
  select
    count(*)::bigint,
    count(*) filter (where created_at >= now() - interval '24 hours')::bigint,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint,
    count(distinct visitor_id)::bigint
  from public.radio_plays;
$$;

create or replace function public.radio_play_top_stations(lim integer)
returns table (
  station text,
  plays bigint
)
language sql
stable
as $$
  select p.station, count(*)::bigint as plays
  from public.radio_plays p
  group by p.station
  order by count(*) desc, p.station asc
  limit greatest(coalesce(lim, 8), 1);
$$;

revoke all on function public.radio_play_summary() from public;
revoke all on function public.radio_play_top_stations(integer) from public;
grant execute on function public.radio_play_summary() to service_role;
grant execute on function public.radio_play_top_stations(integer) to service_role;
