create or replace function public.potential_notifications() returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  p record; v numeric := call_value(); target int := 50; workdays int := 26; floor_tl numeric := 30000;
  loc timestamp := now() at time zone 'Europe/Istanbul';
  today text := to_char(loc, 'YYYYMMDD');
  wk int; lost numeric;
begin
  if (extract(hour from loc) > 20 or (extract(hour from loc) = 20 and extract(minute from loc) >= 30)) and extract(isodow from loc) < 7 then
    for p in select id, today_calls from rivalry loop
      if p.today_calls >= target then
        perform notify(array[p.id], 'potansiyel', '💰 Bugün ' || p.today_calls || ' arama!',
          'Her gün böyle gidersen ayda ' || tl(greatest(floor_tl, p.today_calls * v * workdays)) || ' potansiyel. Yarın da aynısı.', '/', 'pot-' || today, null);
      else
        lost := greatest(floor_tl, (target - p.today_calls) * v * workdays);
        perform notify(array[p.id], 'potansiyel', '📉 Bu tempoyla ayda ' || tl(lost) || ' masada kalıyor',
          'Bugün sadece ' || p.today_calls || ' arama. Her gün ' || target || ' arama yapmayınca kaybın bu. Yarın telafi et.', '/', 'pot-' || today, null);
      end if;
    end loop;
  end if;
  if extract(isodow from loc) = 7 and (extract(hour from loc) > 20 or (extract(hour from loc) = 20 and extract(minute from loc) >= 30)) then
    for p in select id, week_calls from rivalry loop
      wk := p.week_calls;
      if wk < target * 6 then
        lost := greatest(floor_tl, (target * 6 - wk) * v * 52 / 12);
        perform notify(array[p.id], 'potansiyel', '📊 Haftalık: ' || wk || ' arama · ayda ' || tl(lost) || ' kaçıyor',
          'Hedef haftada ' || (target * 6) || ' arama. Bu tempo devam ederse kaybın ayda ' || tl(lost) || ', yılda ' || tl(lost * 12) || '.', '/', 'potw-' || today, null);
      else
        perform notify(array[p.id], 'potansiyel', '📊 Haftalık: ' || wk || ' arama 🏆',
          'Hedefi geçtin! Bu tempoyla yıllık ' || tl(greatest(floor_tl * 12, wk * 52 * v)) || '. 1 milyona bu yoldan gidilir.', '/', 'potw-' || today, null);
      end if;
    end loop;
  end if;
end $function$;
