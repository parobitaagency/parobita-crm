-- Bildirim kuralları. Cron anahtarı veritabanı kasasında (vault) 'cron_secret' adıyla durur.
alter table public.notifications add column if not exists dedupe_key text unique;

create or replace function public.notify(uids uuid[], k text, ttl text, bdy text, u text, key text, ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare x uuid;
begin
  foreach x in array (select array_agg(distinct v) from unnest(uids) v where v is not null) loop
    insert into notifications(user_id, kind, title, body, url, ref_id, dedupe_key)
    values (x, k, ttl, bdy, u, ref, key || ':' || x)
    on conflict (dedupe_key) do nothing;
  end loop;
end $$;

create or replace function public.generate_notifications() returns void language plpgsql security definer set search_path = public as $$
declare
  m record; d record; p record;
  loc timestamp := now() at time zone 'Europe/Istanbul';
  today text := to_char(loc, 'YYYYMMDD');
  day_start timestamptz := date_trunc('day', loc) at time zone 'Europe/Istanbul';
  q text;
begin
  -- 1) Eksik bilgili toplantı: hemen, 1 saat sonra, akşam 21:00, her sabah 09:00
  for m in select mt.*, l.business_name from meetings mt join leads l on l.id = mt.lead_id
           where mt.status = 'planli' and (mt.scheduled_at is null or coalesce(trim(mt.contact_name), '') = '')
             and mt.created_at > now() - interval '14 days'
  loop
    perform notify(array_append(m.attendees, m.created_by), 'eksik', '⚠️ Eksik bilgi: ' || m.business_name,
      concat_ws(' ', case when m.scheduled_at is null then 'Toplantı saati girilmedi.' end,
                     case when coalesce(trim(m.contact_name), '') = '' then 'Yetkili adı girilmedi.' end),
      '/toplantilar', 'eksik-ilk-' || m.id, m.id);
    if now() > m.created_at + interval '1 hour' then
      perform notify(array_append(m.attendees, m.created_by), 'eksik', '⚠️ Hâlâ eksik: ' || m.business_name, 'Toplantı bilgilerini tamamla.', '/toplantilar', 'eksik-1s-' || m.id, m.id);
    end if;
    if extract(hour from loc) >= 21 then
      perform notify(array_append(m.attendees, m.created_by), 'eksik', '⚠️ Eksik toplantı: ' || m.business_name, 'Gün bitmeden saati ve ismi gir.', '/toplantilar', 'eksik-aksam-' || today || '-' || m.id, m.id);
    end if;
    if extract(hour from loc) >= 9 and m.created_at < day_start then
      perform notify(array_append(m.attendees, m.created_by), 'eksik', '⚠️ Eksik toplantı: ' || m.business_name, 'Dünden kalan eksik bilgi var.', '/toplantilar', 'eksik-sabah-' || today || '-' || m.id, m.id);
    end if;
  end loop;

  -- 2) Toplantıdan 1 saat önce
  for m in select mt.*, l.business_name, l.district from meetings mt join leads l on l.id = mt.lead_id
           where mt.status = 'planli' and mt.scheduled_at between now() and now() + interval '65 minutes'
  loop
    perform notify(array_append(m.attendees, m.created_by), 'yaklasan',
      '📅 ' || to_char(m.scheduled_at at time zone 'Europe/Istanbul', 'HH24:MI') || ' · ' || m.business_name,
      concat_ws(' · ', 'Toplantıya 1 saat var', m.contact_name, m.district), '/toplantilar', 'once-' || m.id, m.id);
  end loop;

  -- 3) "Nasıl geçti?": bitişte, 1 saat sonra, akşam 21:00, sonra her sabah 09:00
  for m in select mt.*, l.business_name from meetings mt join leads l on l.id = mt.lead_id
           where mt.status = 'planli' and not mt.result_entered and mt.scheduled_at is not null
             and mt.scheduled_at + make_interval(mins => mt.duration_min) < now()
             and mt.scheduled_at > now() - interval '30 days'
  loop
    perform notify(array_append(m.attendees, m.created_by), 'sonuc', '🤝 ' || m.business_name || ' nasıl geçti?', 'Sonucu gir: satış, düşünüyor ya da kayıp.', '/toplantilar', 'sonuc-bitis-' || m.id, m.id);
    if now() > m.scheduled_at + make_interval(mins => m.duration_min + 60) then
      perform notify(array_append(m.attendees, m.created_by), 'sonuc', '🤝 ' || m.business_name || ' sonucu hâlâ yok', 'Unutmadan gir.', '/toplantilar', 'sonuc-1s-' || m.id, m.id);
    end if;
    if extract(hour from loc) >= 21 then
      perform notify(array_append(m.attendees, m.created_by), 'sonuc', '🤝 ' || m.business_name || ' nasıl geçti?', 'Gün bitmeden sonucu gir.', '/toplantilar', 'sonuc-aksam-' || today || '-' || m.id, m.id);
    end if;
    if extract(hour from loc) >= 9 and m.scheduled_at < day_start then
      perform notify(array_append(m.attendees, m.created_by), 'sonuc', '🤝 ' || m.business_name || ' sonucu bekleniyor', 'Dünden kalan toplantı sonucu girilmedi.', '/toplantilar', 'sonuc-sabah-' || today || '-' || m.id, m.id);
    end if;
  end loop;

  -- 4) Satış takibi: önce ara, sonra çat kapı
  for d in select dl.*, l.business_name from deals dl join leads l on l.id = dl.lead_id
           where dl.stage in ('demo','teklif','dusunuyor') and dl.next_followup_at <= now()
  loop
    perform notify(array[d.owner_id, d.caller_id], 'takip',
      case when d.followup_step = 'cat_kapi' then '🚪 Çat kapı zamanı: ' else '📞 Takip zamanı: ' end || d.business_name,
      case when d.followup_step = 'cat_kapi' then 'Aramaya dönmediler. Habersiz uğra.' else 'Bugün ara, ne düşündüklerini sor.' end,
      '/satislar', 'takip-' || to_char(d.next_followup_at, 'YYYYMMDDHH24MI') || '-' || d.id, d.id);
  end loop;

  -- 5) 14:00 olmuş, bugün hiç arama yok (Pazar hariç)
  if extract(hour from loc) >= 14 and extract(isodow from loc) < 7 then
    for p in select r.id from rivalry r where r.today_calls = 0 loop
      perform notify(array[p.id], 'hatirlatma', 'Saat 14:00 oldu ☎︎', 'Bugün henüz tek arama yok. Telefonu al.', '/', 'arama0-' || today, null);
    end loop;
  end if;

  -- 6) Günlük motivasyon, 10:00
  if extract(hour from loc) >= 10 then
    select text into q from quotes where active order by random() limit 1;
    for p in select id from profiles loop
      perform notify(array[p.id], 'motivasyon', 'Parobita', q, '/', 'motiv-' || today, null);
    end loop;
  end if;
end $$;

-- Gönderici: kasadaki anahtarla push fonksiyonunu çağırır
create or replace function public.call_push() returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://lzxkowlecpiwvbwrjqxs.supabase.co/functions/v1/push',
    headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 30000);
end $$;
revoke execute on function public.call_push() from public, anon, authenticated;
revoke execute on function public.generate_notifications() from public, anon, authenticated;
revoke execute on function public.detect_escapes() from public, anon, authenticated;
revoke execute on function public.notify(uuid[], text, text, text, text, text, uuid) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('generate_notifications', 'send_push');
select cron.schedule('generate_notifications', '* * * * *', $c$select public.generate_notifications()$c$);
select cron.schedule('send_push', '* * * * *', $c$select public.call_push()$c$);
