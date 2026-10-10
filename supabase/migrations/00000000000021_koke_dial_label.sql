-- KOKE's key reads as Austin country, not the call letters.
update public.radio_stations
set dial_label = 'ATX CTRY'
where upper(coalesce(call_sign, '')) = 'KOKE';
