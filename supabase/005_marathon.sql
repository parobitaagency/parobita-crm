create table if not exists public.marathons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target int not null check (target >= 20),
  done int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists marathons_one_active on public.marathons(user_id) where finished_at is null;
alter table public.marathons enable row level security;
drop policy if exists p_marathons on public.marathons;
create policy p_marathons on public.marathons for select to authenticated using (user_id = auth.uid() or public.is_owner());
grant select on public.marathons to authenticated;

create or replace function public.sc_uid(t text) returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from profiles where shortcut_token = t;
  if uid is null then raise exception 'gecersiz anahtar'; end if;
  return uid;
end $$;

-- Aktif maraton durumu: {active, done, target, left}
create or replace function public.sc_status(t text) returns json language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('active', true, 'done', done, 'target', target, 'left', target - done)
       from marathons where user_id = sc_uid(t) and finished_at is null),
    json_build_object('active', false, 'done', 0, 'target', 0, 'left', 0))
$$;

create or replace function public.sc_marathon_start(t text, target int) returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := sc_uid(t);
begin
  if exists (select 1 from marathons where user_id = uid and finished_at is null) then return sc_status(t); end if;
  insert into marathons(user_id, target) values (uid, greatest(coalesce(target, 20), 20));
  return sc_status(t);
end $$;

-- Sonuç kaydında maraton sayacını ilerlet
create or replace function public.sc_result(t text, lead uuid, outcome text, at_time text default null, contact text default null, note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := sc_uid(t); ts timestamptz; mid uuid; m marathons;
begin
  if not exists (select 1 from leads where id = lead and assigned_to = uid) then raise exception 'lead bulunamadi'; end if;
  if outcome not in ('toplanti','red','acmadi','sonra_ara') then raise exception 'gecersiz sonuc'; end if;
  begin ts := nullif(trim(at_time), '')::timestamptz; exception when others then ts := null; end;
  insert into calls(lead_id, user_id, outcome, note) values (lead, uid, outcome, nullif(trim(note), ''));
  if outcome = 'toplanti' then
    insert into meetings(lead_id, created_by, attendees, scheduled_at, contact_name)
    values (lead, uid, array[uid], ts, nullif(trim(contact), '')) returning id into mid;
  elsif outcome = 'sonra_ara' then
    update leads set call_back_at = coalesce(ts, now() + interval '1 day') where id = lead;
  end if;
  update marathons set done = done + 1,
         finished_at = case when done + 1 >= target then now() else null end
   where user_id = uid and finished_at is null
  returning * into m;
  return json_build_object('ok', true, 'meeting', mid,
    'marathon_done', coalesce(m.done, 0), 'marathon_target', coalesce(m.target, 0),
    'marathon_finished', m.finished_at is not null);
end $$;

-- Liste biterse maratonu kapat (aranacak kimse kalmadıysa sonsuza kadar kilitli kalmasın)
create or replace function public.sc_marathon_end_empty(t text) returns json language sql security definer set search_path = public as $$
  update marathons set finished_at = now() where user_id = sc_uid(t) and finished_at is null;
  select sc_status(t);
$$;

grant execute on function public.sc_status(text), public.sc_marathon_start(text, int), public.sc_marathon_end_empty(text),
  public.sc_result(text, uuid, text, text, text, text) to anon, authenticated;
