-- Notion "Satış Takibi Hatırlatıcı" görevinin CRM karşılığı: sabah 09:10 ve akşam 20:10 özet
create or replace function sales_digest() returns void language plpgsql security definer set search_path=public as $$
declare
  loc timestamp := now() at time zone 'Europe/Istanbul';
  today text := to_char(loc,'YYYYMMDD');
  day_end timestamptz := (date_trunc('day', loc) + interval '1 day') at time zone 'Europe/Istanbul';
  day_start timestamptz := date_trunc('day', loc) at time zone 'Europe/Istanbul';
  p record; due text; due_n int; nodate text; awaiting int; late text; todays text; body text;
begin
  if extract(isodow from loc) = 7 then return; end if;
  -- SABAH
  if (extract(hour from loc) > 9 or (extract(hour from loc) = 9 and extract(minute from loc) >= 10)) and extract(hour from loc) < 15 then
    for p in select id from profiles loop
      select count(*), string_agg(l.business_name || ' (' || case d.stage when 'toplanti' then 'toplantı' when 'teklif' then 'teklif verildi' when 'dusunuyor' then 'düşünüyor' when 'demo' then 'demo' end || ')', ', ' order by d.next_followup_at)
        into due_n, due
        from deals d join leads l on l.id=d.lead_id
       where coalesce(d.owner_id,d.caller_id)=p.id and d.stage not in ('satis','kayip') and d.next_followup_at < day_end;
      select string_agg(l.business_name, ', ') into nodate from deals d join leads l on l.id=d.lead_id
       where coalesce(d.owner_id,d.caller_id)=p.id and d.stage not in ('satis','kayip') and d.next_followup_at is null
         and not exists (select 1 from meetings m where m.lead_id=d.lead_id and m.status='planli' and m.scheduled_at > now());
      select count(*) into awaiting from meetings_awaiting_result m where p.id = any(array_append(m.attendees, m.created_by));
      if due_n > 0 or nodate is not null or awaiting > 0 then
        body := concat_ws(E'\n',
          case when due_n > 0 then 'Bugün ' || due_n || ' takip: ' || due end,
          case when awaiting > 0 then 'Sonucu girilmemiş toplantı: ' || awaiting end,
          case when nodate is not null then '⚠️ Takip tarihi yok: ' || nodate end);
        perform notify(array[p.id], 'takip', '☀️ Bugünün satış takibi', body, '/satislar', 'digest-sabah-' || today, null);
      end if;
    end loop;
  end if;
  -- AKŞAM
  if (extract(hour from loc) > 20 or (extract(hour from loc) = 20 and extract(minute from loc) >= 10)) and extract(hour from loc) < 22 then
    for p in select id from profiles loop
      select string_agg(business_name, ', ') into todays from meetings_awaiting_result m
       where p.id = any(array_append(m.attendees, m.created_by)) and m.scheduled_at >= day_start;
      select string_agg(l.business_name, ', ') into late from deals d join leads l on l.id=d.lead_id
       where coalesce(d.owner_id,d.caller_id)=p.id and d.stage not in ('satis','kayip') and d.next_followup_at < now();
      if todays is not null or late is not null then
        body := concat_ws(E'\n',
          case when todays is not null then 'Bugünkü toplantıların sonucu girilmedi: ' || todays end,
          case when late is not null then 'Takibi güncellenmedi: ' || late || '. Aradıysan sonucu ve yeni tarihi gir.' end);
        perform notify(array[p.id], 'takip', '🌙 Satış takibi', body, '/satislar', 'digest-aksam-' || today, null);
      end if;
    end loop;
  end if;
end $$;
select cron.schedule('sales_digest', '*/5 * * * *', 'select sales_digest()');
