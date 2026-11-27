create table if not exists bot_config(id int primary key default 1, token text not null);
alter table bot_config enable row level security; revoke all on bot_config from anon, authenticated;
insert into bot_config(id,token) values(1,'<BOT_TOKEN>') on conflict(id) do update set token=excluded.token;
create table if not exists daily_reports(id bigserial primary key, report_date date default (now() at time zone 'Europe/Istanbul')::date, body text, created_at timestamptz default now());
alter table daily_reports enable row level security; revoke all on daily_reports from anon;
grant select on daily_reports to authenticated;
drop policy if exists dr_read on daily_reports; create policy dr_read on daily_reports for select to authenticated using (true);

create or replace function bot_ok(t text) returns void language plpgsql security definer set search_path=public as $$
begin if not exists(select 1 from bot_config where token=t) then raise exception 'bad token'; end if; end $$;

create or replace function bot_digits(p text) returns text language sql immutable as $$ select nullif(right(regexp_replace(coalesce(p,''),'\D','','g'),10),'') $$;

-- Mükerrer kontrolü: [{name,phone}] -> her biri için var mı, nerede
create or replace function bot_check(t text, items json) returns json language plpgsql security definer set search_path=public as $$
begin perform bot_ok(t);
return (select json_agg(json_build_object('name',i->>'name','phone',i->>'phone',
  'lead', (select business_name||' ('||status||')' from leads l where lower(l.business_name)=lower(i->>'name') or (bot_digits(i->>'phone') is not null and bot_digits(l.phone)=bot_digits(i->>'phone')) limit 1),
  'blocked', (select coalesce(reason,source) from lead_blocklist b where lower(b.business_name)=lower(i->>'name') or (bot_digits(i->>'phone') is not null and b.phone_digits=bot_digits(i->>'phone')) limit 1)))
  from json_array_elements(items) i);
end $$;

-- Bağlam: son 7 günün niş+semt kombinasyonları, son raporlar, bugünkü sayılar
create or replace function bot_context(t text) returns json language plpgsql security definer set search_path=public as $$
declare d date := (now() at time zone 'Europe/Istanbul')::date;
begin perform bot_ok(t);
return json_build_object(
 'today', d,
 'today_counts', (select json_object_agg(p.full_name, (select count(*) from leads l where l.assigned_to=p.id and l.list_date=d and l.source='bot')) from profiles p),
 'combos_7d', (select json_agg(x) from (select niche, district, count(*) n from leads where list_date >= d-7 and source in('bot','notion') group by 1,2 order by 3 desc limit 80) x),
 'reports', (select json_agg(x) from (select report_date, body from daily_reports order by id desc limit 5) x));
end $$;

-- Lead ekleme: [{who:'burak'|'korhan', name, phone, niche, district, address, maps_url, instagram, rating, reviews, tier, reason}]
create or replace function bot_add_leads(t text, items json) returns json language plpgsql security definer set search_path=public as $$
declare i json; uid uuid; d date := (now() at time zone 'Europe/Istanbul')::date; added int := 0; skipped json := '[]'::json; nx int;
begin perform bot_ok(t);
for i in select * from json_array_elements(items) loop
  uid := (select p.id from profiles p join auth.users u on u.id=p.id where u.email like case lower(i->>'who') when 'korhan' then 'korhan%' else 'burak%' end limit 1);
  if coalesce(i->>'name','')='' or bot_digits(i->>'phone') is null
     or exists(select 1 from leads l where lower(l.business_name)=lower(i->>'name') or bot_digits(l.phone)=bot_digits(i->>'phone'))
     or exists(select 1 from lead_blocklist b where (lower(b.business_name)=lower(i->>'name') or b.phone_digits=bot_digits(i->>'phone')) and coalesce(b.reason,'') not like 'Reddedildi%') then
    skipped := (skipped::jsonb || jsonb_build_array(i->>'name'))::json; continue;
  end if;
  select coalesce(max(sort_order),0)+1 into nx from leads where assigned_to=uid and list_date=d;
  insert into leads(assigned_to,business_name,phone,niche,district,address,maps_url,rating,review_count,tier,notes,status,channel,list_date,sort_order,source)
  values(uid, i->>'name', i->>'phone', i->>'niche', i->>'district', i->>'address', i->>'maps_url', nullif(i->>'rating','')::numeric, nullif(i->>'reviews','')::int, case upper(left(i->>'tier',1)) when 'A' then 'ust' when 'B' then 'orta' when 'C' then 'alt' end,
    concat_ws(E'\n', 'Neden seçildi: '||(i->>'reason'), 'Instagram: '||nullif(i->>'instagram','')), 'yeni','ara', d, nx, 'bot');
  added := added + 1;
end loop;
return json_build_object('added',added,'skipped',skipped);
end $$;

-- Elenenler: [{name, phone, reason}]
create or replace function bot_block(t text, items json) returns int language plpgsql security definer set search_path=public as $$
declare n int; begin perform bot_ok(t);
insert into lead_blocklist(business_name,phone_digits,reason,source)
 select i->>'name', bot_digits(i->>'phone'), i->>'reason', 'bot' from json_array_elements(items) i
 where not exists(select 1 from lead_blocklist b where lower(b.business_name)=lower(i->>'name'));
get diagnostics n = row_count; return n; end $$;

create or replace function bot_report(t text, body text) returns void language plpgsql security definer set search_path=public as $$
begin perform bot_ok(t); insert into daily_reports(body) values(body); end $$;

revoke all on function bot_ok, bot_check, bot_context, bot_add_leads, bot_block, bot_report from public;
grant execute on function bot_check, bot_context, bot_add_leads, bot_block, bot_report to anon;
notify pgrst, 'reload schema';
