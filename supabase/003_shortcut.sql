-- iPhone arama kestirmesi için kullanıcıya özel anahtar ve fonksiyonlar
alter table public.profiles add column if not exists shortcut_token text unique default encode(gen_random_bytes(18), 'hex');
update public.profiles set shortcut_token = encode(gen_random_bytes(18), 'hex') where shortcut_token is null;

-- Profil satırını okuyan herkes anahtarı görmesin
revoke select on public.profiles from authenticated;
grant select (id, full_name, role, phone, notify_quiet_start, notify_quiet_end, created_at) on public.profiles to authenticated;

create or replace function public.my_shortcut_token() returns text
language sql stable security definer set search_path = public as $$
  select shortcut_token from profiles where id = auth.uid()
$$;
grant execute on function public.my_shortcut_token() to authenticated;

-- Sıradaki aranacak lead: önce vakti gelmiş "sonra ara"lar, sonra açmayanlar ve yeniler
create or replace function public.sc_next(t text, skip uuid[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid; r leads;
begin
  select id into uid from profiles where shortcut_token = t;
  if uid is null then raise exception 'gecersiz anahtar'; end if;
  select * into r from leads
   where assigned_to = uid and phone is not null and not (id = any(skip))
     and (status in ('yeni','acmadi') or (status = 'sonra_ara' and call_back_at <= now()))
     and not exists (select 1 from calls c where c.lead_id = leads.id and c.called_at > now() - interval '3 hours')
   order by case when status = 'sonra_ara' then 0 when status = 'yeni' then 1 else 2 end,
            list_date nulls last, sort_order nulls last
   limit 1;
  if r.id is null then return json_build_object('done', true, 'id', '', 'name', 'Liste bitti', 'phone', ''); end if;
  return json_build_object('done', false, 'id', r.id, 'name', r.business_name, 'phone', r.phone,
    'info', concat_ws(' · ', r.niche, r.district, case when r.rating is not null then '★ ' || r.rating end),
    'address', coalesce(r.address, r.district, ''));
end $$;

-- Arama sonucunu kaydet. outcome: toplanti | red | acmadi | sonra_ara
create or replace function public.sc_result(t text, lead uuid, outcome text, at_time text default null, contact text default null, note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid; ts timestamptz; mid uuid;
begin
  select id into uid from profiles where shortcut_token = t;
  if uid is null then raise exception 'gecersiz anahtar'; end if;
  if not exists (select 1 from leads where id = lead and assigned_to = uid) then raise exception 'lead bulunamadi'; end if;
  begin ts := nullif(trim(at_time), '')::timestamptz; exception when others then ts := null; end;
  insert into calls(lead_id, user_id, outcome, note) values (lead, uid, outcome, nullif(trim(note), ''));
  if outcome = 'toplanti' then
    insert into meetings(lead_id, created_by, attendees, scheduled_at, contact_name)
    values (lead, uid, array[uid], ts, nullif(trim(contact), '')) returning id into mid;
  elsif outcome = 'sonra_ara' then
    update leads set call_back_at = coalesce(ts, now() + interval '1 day') where id = lead;
  end if;
  return json_build_object('ok', true, 'meeting', mid);
end $$;

grant execute on function public.sc_next(text, uuid[]) to anon, authenticated;
grant execute on function public.sc_result(text, uuid, text, text, text, text) to anon, authenticated;
