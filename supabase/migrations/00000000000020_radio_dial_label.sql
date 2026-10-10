-- Short name printed on a preset key. The call sign and frequency stay
-- on the readout and the chart.

alter table public.radio_stations
  add column if not exists dial_label text;

alter table public.radio_stations
  drop constraint if exists radio_stations_dial_label_len;

alter table public.radio_stations
  add constraint radio_stations_dial_label_len
  check (dial_label is null or char_length(dial_label) <= 10);

update public.radio_stations set dial_label = 'THE RANCH' where upper(coalesce(call_sign, '')) = 'KFWR';
update public.radio_stations set dial_label = 'KOKE' where upper(coalesce(call_sign, '')) = 'KOKE';
update public.radio_stations set dial_label = 'GATOR' where upper(coalesce(call_sign, '')) = 'WGNE';
update public.radio_stations set dial_label = 'THE GIANT' where upper(coalesce(call_sign, '')) = 'WQSB';
update public.radio_stations set dial_label = 'CTRY RAP' where upper(coalesce(call_sign, '')) = 'WCRR';
update public.radio_stations set dial_label = 'BIGFOOT' where upper(coalesce(call_sign, '')) = 'WWCH';
update public.radio_stations set dial_label = 'BIG CTRY' where upper(coalesce(call_sign, '')) = 'WWON';
update public.radio_stations set dial_label = 'ORIGINAL' where upper(coalesce(call_sign, '')) = 'KHOZ';
update public.radio_stations set dial_label = 'TOP CTRY' where upper(coalesce(call_sign, '')) = 'KNCI';
update public.radio_stations set dial_label = 'REBEL' where upper(coalesce(call_sign, '')) = 'KNAF';
update public.radio_stations set dial_label = 'BIG DRM' where upper(coalesce(call_sign, '')) = 'WDRM';
update public.radio_stations set dial_label = '80s CTRY' where station_name ilike '181.FM%';
update public.radio_stations set dial_label = 'OPRY' where upper(coalesce(call_sign, '')) = 'WSM';
update public.radio_stations set dial_label = 'BASEBALL' where upper(coalesce(call_sign, '')) = 'BASEBALL';
update public.radio_stations set dial_label = 'FREE TEXAS' where call_sign = 'Radio Free Texas';
