-- "Kaçan potansiyel" bildirimleri: arama başına ortalama değer üzerinden
create or replace function public.call_value() returns numeric language sql stable security definer set search_path = public as $$
  with s as (
    select (select count(*) from calls c join leads l on l.id = c.lead_id where l.source <> 'test') as calls,
           (select count(*) from calls c join leads l on l.id = c.lead_id where l.source <> 'test' and c.outcome = 'toplanti') as meetings,
           (select count(*) from deals where stage = 'satis') as sales,
           (select avg(amount) from deals where stage = 'satis' and amount > 0) as avg_sale,
           (select count(*) from deals where stage in ('satis','kayip')) as closed
  )
  select case when calls >= 200 and meetings >= 20 and closed >= 10 and avg_sale is not null
              then (meetings::numeric / calls) * (sales::numeric / closed) * avg_sale
              else 0.07 * 0.10 * 12000 end
    from s
$$;

create or replace function public.tl(n numeric) returns text language sql immutable as $$
  select replace(to_char(round(n, -2), 'FM999G999G999'), ',', '.') || ' TL'
$$;

create or replace function public.potential_notifications() returns void language plpgsql security definer set search_path = public as $$
declare
  p record; v numeric := call_value(); target int := 50; workdays int := 26;
  loc timestamp := now() at time zone 'Europe/Istanbul';
  today text := to_char(loc, 'YYYYMMDD');
  wk int; missed numeric;
begin
  -- Her akşam 20:30 (Pazar hariç): bugünkü tempo ve kaçan potansiyel
  if (extract(hour from loc) > 20 or (extract(hour from loc) = 20 and extract(minute from loc) >= 30)) and extract(isodow from loc) < 7 then
    for p in select id, today_calls from rivalry loop
      if p.today_calls >= target then
        perform notify(array[p.id], 'potansiyel', '💰 Bugün ' || p.today_calls || ' arama!',
          'Bugün yaklaşık ' || tl(p.today_calls * v) || ' potansiyel yarattın. Her gün böyle gidersen ayda ' || tl(p.today_calls * v * workdays) || '.', '/', 'pot-' || today, null);
      else
        missed := (target - p.today_calls) * v;
        perform notify(array[p.id], 'potansiyel', '📉 Bugün ' || tl(missed) || ' masada kaldı',
          'Bugün ' || p.today_calls || ' arama yaptın. ' || target || ' yapsaydın aylık kazanç ' || tl(target * v * workdays) || ' olurdu; bu tempoyla ' || tl(p.today_calls * v * workdays) || '.', '/', 'pot-' || today, null);
      end if;
    end loop;
  end if;

  -- Pazar 20:30: haftalık özet
  if extract(isodow from loc) = 7 and (extract(hour from loc) > 20 or (extract(hour from loc) = 20 and extract(minute from loc) >= 30)) then
    for p in select id, week_calls from rivalry loop
      wk := p.week_calls;
      missed := greatest(0, target * 6 - wk) * v;
      perform notify(array[p.id], 'potansiyel', '📊 Haftalık: ' || wk || ' arama',
        case when missed > 0 then 'Bu hafta yaklaşık ' || tl(missed) || ' potansiyel kaçtı. Haftada ' || (target * 6) || ' aramayla yıllık ' || tl(target * 6 * 52 * v) || ' yolu açık.'
             else 'Hedefi geçtin! Bu tempoyla yıllık ' || tl(wk * 52 * v) || '. 1 milyona bu yoldan gidilir.' end,
        '/', 'potw-' || today, null);
    end loop;
  end if;
end $$;
revoke execute on function public.potential_notifications() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'potential_notifications';
select cron.schedule('potential_notifications', '*/5 * * * *', $c$select public.potential_notifications()$c$);
