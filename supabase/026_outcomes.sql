
alter table leads drop constraint leads_status_check;
alter table leads add constraint leads_status_check check (status = any (array['yeni','acmadi','sonra_ara','red','toplanti','musteri','wp','uzun_vade','gecersiz']));
alter table calls drop constraint calls_outcome_check;
alter table calls add constraint calls_outcome_check check (outcome = any (array['acmadi','sonra_ara','red','toplanti','wp','uzun_vade','gecersiz']));
alter table leads add column if not exists wa_sent_at timestamptz;

-- '+2d', '+1w', '+3m' gibi göreli zamanları ya da ISO tarihi çöz
create or replace function parse_when(s text, dflt interval) returns timestamptz language plpgsql stable as $$
declare m text[];
begin
  if s is null or trim(s) = '' then return now() + dflt; end if;
  m := regexp_match(trim(s), '^\+(\d+)([hdwm])$');
  if m is not null then
    return now() + (m[1] || case m[2] when 'h' then ' hours' when 'd' then ' days' when 'w' then ' weeks' else ' months' end)::interval;
  end if;
  begin return trim(s)::timestamptz; exception when others then return now() + dflt; end;
end $$;

-- Arama sonucu lead'e işlenir (kısayol, çevrimdışı senkron ve CRM ortak)
create or replace function apply_outcome(lead uuid, outcome text, at_time text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if outcome = 'sonra_ara' then update leads set call_back_at = parse_when(at_time, interval '1 day') where id = lead;
  elsif outcome = 'wp' then update leads set call_back_at = parse_when(at_time, interval '2 days'), wa_sent_at = null where id = lead;
  elsif outcome = 'uzun_vade' then update leads set call_back_at = parse_when(at_time, interval '3 months') where id = lead;
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.sc_result(t text, lead uuid, outcome text, at_time text DEFAULT NULL::text, contact text DEFAULT NULL::text, note text DEFAULT NULL::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := sc_uid(t); ts timestamptz; mid uuid; m marathons;
begin
  if not exists (select 1 from leads where id = lead and assigned_to = uid) then raise exception 'lead bulunamadi'; end if;
  if outcome not in ('toplanti','red','acmadi','sonra_ara','wp','uzun_vade','gecersiz') then raise exception 'gecersiz sonuc'; end if;
  begin ts := nullif(trim(at_time), '')::timestamptz; exception when others then ts := null; end;
  insert into calls(lead_id, user_id, outcome, note) values (lead, uid, outcome, nullif(trim(note), ''));
  if outcome = 'toplanti' then
    insert into meetings(lead_id, created_by, attendees, scheduled_at, contact_name)
    values (lead, uid, array[uid], ts, nullif(trim(contact), '')) returning id into mid;
  else
    perform apply_outcome(lead, outcome, at_time);
  end if;
  update marathons set done = done + 1,
         finished_at = case when done + 1 >= target then now() else null end
   where user_id = uid and finished_at is null
  returning * into m;
  return json_build_object('ok', true, 'meeting', mid,
    'marathon_done', coalesce(m.done, 0), 'marathon_target', coalesce(m.target, 0),
    'marathon_finished', m.finished_at is not null);
end $function$;

CREATE OR REPLACE FUNCTION public.sc_sync(t text, results text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := sc_uid(t); line text; r jsonb; ts timestamptz; called timestamptz; applied int := 0; lst json; txt text;
begin
  foreach line in array string_to_array(coalesce(results, ''), E'\n') loop
    continue when trim(line) = '';
    -- satır biçimi: lead¦sonuç¦zaman¦yetkili¦ref¦arama zamanı
    if position('¦' in line) > 0 then
      r := jsonb_build_object('lead', split_part(trim(line), '¦', 1), 'outcome', split_part(trim(line), '¦', 2),
             'at', split_part(trim(line), '¦', 3), 'contact', split_part(trim(line), '¦', 4),
             'ref', split_part(trim(line), '¦', 5), 'called', split_part(trim(line), '¦', 6));
    else
      begin r := trim(line)::jsonb; exception when others then continue; end;
    end if;
    begin perform (r->>'lead')::uuid; exception when others then continue; end;
    continue when not exists (select 1 from leads where id = (r->>'lead')::uuid and assigned_to = uid);
    continue when (r->>'outcome') not in ('toplanti','red','acmadi','sonra_ara','wp','uzun_vade','gecersiz');
    continue when exists (select 1 from calls where client_ref = r->>'ref');
    begin ts := nullif(trim(r->>'at'), '')::timestamptz; exception when others then ts := null; end;
    begin called := nullif(trim(r->>'called'), '')::timestamptz; exception when others then called := now(); end;
    insert into calls(lead_id, user_id, outcome, called_at, client_ref)
    values ((r->>'lead')::uuid, uid, r->>'outcome', coalesce(called, now()), r->>'ref');
    if r->>'outcome' = 'toplanti' then
      insert into meetings(lead_id, created_by, attendees, scheduled_at, contact_name)
      values ((r->>'lead')::uuid, uid, array[uid], ts, nullif(trim(r->>'contact'), ''));
    else
      perform apply_outcome((r->>'lead')::uuid, r->>'outcome', r->>'at');
    end if;
    applied := applied + 1;
  end loop;

  -- Önümüzdeki aramalar için liste (sıra sunucudaki ile aynı)
  select coalesce(json_agg(x), '[]'::json) into lst from (
    select id, business_name as name, phone,
           concat_ws(' · ', niche, district, case when rating is not null then '★ ' || rating end) as info
      from call_queue(uid, 80, interval '1 day')) x;
  select string_agg(concat_ws('¦', x->>'id', replace(x->>'name', '¦', ' '), x->>'phone', coalesce(nullif(x->>'info', ''), '-')), E'\n')
    into txt from json_array_elements(lst) x;
  return json_build_object('applied', applied, 'leads', lst, 'leads_txt', coalesce(txt, ''), 'count', json_array_length(lst), 'header', sc_header(uid), 'synced_at', to_char(now() at time zone 'Europe/Istanbul', 'DD.MM HH24:MI'));
end $function$

;

CREATE OR REPLACE FUNCTION public.call_queue(uid uuid, lim integer DEFAULT 400, horizon interval DEFAULT '00:00:00'::interval)
 RETURNS SETOF leads
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.* from leads l
  join profiles p on p.id = uid
  left join app_settings s on s.id = 1
  where l.assigned_to = uid and l.phone is not null and l.source <> 'test'
    and (l.status in ('yeni','acmadi') or (l.status in ('sonra_ara','wp','uzun_vade') and l.call_back_at <= now() + horizon))
    and (coalesce(p.call_prefs->>'niche','') = '' or l.niche = p.call_prefs->>'niche')
    and (coalesce(p.call_prefs->>'district','') = '' or l.district ilike '%' || (p.call_prefs->>'district') || '%')
    and (jsonb_array_length(coalesce(p.call_prefs->'statuses','[]'::jsonb)) = 0
         or l.status in (select jsonb_array_elements_text(p.call_prefs->'statuses')))
  order by
    case when l.status in ('sonra_ara','wp','uzun_vade') then 0 else 1 end,
    case when p.call_prefs->>'sort' = 'yakin' then km(coalesce((p.call_prefs->>'olat')::float8, s.base_lat), coalesce((p.call_prefs->>'olng')::float8, s.base_lng), l.lat, l.lng) end nulls last,
    case p.call_prefs->>'sort' when 'puan' then -l.rating when 'yorum' then -l.review_count end nulls last,
    case when p.call_prefs->>'sort' = 'isim' then l.business_name end,
    case when l.status = 'yeni' then 1 else 2 end, l.list_date nulls last, l.sort_order nulls last
  limit lim
$function$

;
