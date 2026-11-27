-- Takvim etkinlikleri (toplantı dışı işler)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_time on public.events(starts_at);
alter table public.events enable row level security;
drop policy if exists p_events on public.events;
create policy p_events on public.events for all to authenticated
  using (public.is_owner() or owner_id = auth.uid())
  with check (public.is_owner() or owner_id = auth.uid());
grant select, insert, update, delete on public.events to authenticated;
drop trigger if exists t_events on public.events;
create trigger t_events before update on public.events for each row execute function public.touch_updated_at();

-- Etkinlikten 30 dakika önce hatırlatma
create or replace function public.event_notifications() returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  for e in select * from events where starts_at between now() and now() + interval '32 minutes' loop
    perform notify(array[e.owner_id], 'etkinlik', '🗓️ ' || to_char(e.starts_at at time zone 'Europe/Istanbul', 'HH24:MI') || ' · ' || e.title,
      coalesce(nullif(e.location, ''), '30 dakika sonra'), '/toplantilar', 'ev-' || e.id || '-' || to_char(e.starts_at, 'YYYYMMDDHH24MI'), e.id);
  end loop;
end $$;
revoke execute on function public.event_notifications() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'event_notifications';
select cron.schedule('event_notifications', '* * * * *', $c$select public.event_notifications()$c$);
notify pgrst, 'reload schema';
