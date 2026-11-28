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
    continue when (r->>'outcome') not in ('toplanti','red','acmadi','sonra_ara');
    continue when exists (select 1 from calls where client_ref = r->>'ref');
    begin ts := nullif(trim(r->>'at'), '')::timestamptz; exception when others then ts := null; end;
    begin called := nullif(trim(r->>'called'), '')::timestamptz; exception when others then called := now(); end;
    insert into calls(lead_id, user_id, outcome, called_at, client_ref)
    values ((r->>'lead')::uuid, uid, r->>'outcome', coalesce(called, now()), r->>'ref');
    if r->>'outcome' = 'toplanti' then
      insert into meetings(lead_id, created_by, attendees, scheduled_at, contact_name)
      values ((r->>'lead')::uuid, uid, array[uid], ts, nullif(trim(r->>'contact'), ''));
    elsif r->>'outcome' = 'sonra_ara' then
      update leads set call_back_at = coalesce(ts, now() + interval '1 day') where id = (r->>'lead')::uuid;
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
