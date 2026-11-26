-- Kaçış takibi ve eziklik skoru
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.marathons add column if not exists abandoned boolean not null default false;
alter table public.marathons add column if not exists last_activity_at timestamptz not null default now();

-- Sonuç kaydı maratonun son hareket zamanını günceller
create or replace function public.touch_marathon() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update marathons set last_activity_at = now() where user_id = new.user_id and finished_at is null;
  return new;
end $$;
drop trigger if exists t_calls_marathon on public.calls;
create trigger t_calls_marathon after insert on public.calls for each row execute function public.touch_marathon();

-- sc_next de hareket sayılır (arama başladı)
create or replace function public.touch_marathon_uid(uid uuid) returns void language sql security definer set search_path = public as $$
  update marathons set last_activity_at = now() where user_id = uid and finished_at is null;
$$;

-- 10 dakika hareketsiz maraton = kaçış
create or replace function public.detect_escapes() returns int language plpgsql security definer set search_path = public as $$
declare m record; n int := 0; who text;
begin
  for m in select * from marathons
           where finished_at is null and last_activity_at < now() - interval '10 minutes'
  loop
    update marathons set finished_at = now(), abandoned = true where id = m.id;
    select full_name into who from profiles where id = m.user_id;
    -- kaçana ve diğer herkese bildirim
    insert into notifications(user_id, kind, title, body, url)
    select p.id, 'kacis',
           case when p.id = m.user_id then 'Maratondan kaçtın 🤡' else split_part(who, ' ', 1) || ' maratondan kaçtı 😂' end,
           case when p.id = m.user_id then m.done || '/' || m.target || ' bıraktın. Eziklik seviyen arttı.'
                else m.done || '/' || m.target || '''de bıraktı. Eziklik seviyesi arttı.' end,
           '/'
      from profiles p;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Skor tablosu: haftalık arama/toplantı, kaçış ve bitirilen maraton, eziklik puanı
create or replace view public.rivalry as
select p.id, p.full_name,
  (select count(*) from calls c where c.user_id = p.id
     and c.called_at >= date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as week_calls,
  (select count(*) from calls c where c.user_id = p.id and c.outcome = 'toplanti'
     and c.called_at >= date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as week_meetings,
  (select count(*) from calls c where c.user_id = p.id
     and c.called_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as today_calls,
  (select count(*) from marathons m where m.user_id = p.id and m.abandoned) as escapes,
  (select count(*) from marathons m where m.user_id = p.id and m.finished_at is not null and not m.abandoned and m.done >= m.target) as finished,
  greatest(0, (select count(*) from marathons m where m.user_id = p.id and m.abandoned)
            - (select count(*) from marathons m where m.user_id = p.id and m.finished_at is not null and not m.abandoned and m.done >= m.target))::int as ezik
from public.profiles p;
alter view public.rivalry set (security_invoker = off);
grant select on public.rivalry to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'detect_escapes';
select cron.schedule('detect_escapes', '* * * * *', $$select public.detect_escapes()$$);
