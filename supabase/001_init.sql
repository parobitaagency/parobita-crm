-- Parobita CRM: ilk şema
create extension if not exists pgcrypto;

-- Kullanıcılar
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'caller' check (role in ('owner','caller')),
  phone text,
  notify_quiet_start time default '22:30',
  notify_quiet_end time default '08:30',
  created_at timestamptz not null default now()
);

-- Lead durumları: yeni, acmadi (⏸️), sonra_ara (⚠️), red (❌), toplanti (✅), musteri
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  assigned_to uuid references public.profiles(id) on delete set null,
  business_name text not null,
  niche text,
  phone text,
  address text,
  district text,
  maps_url text,
  rating numeric(2,1),
  review_count int,
  website_note text,
  tier text check (tier in ('ust','orta','alt')),
  channel text not null default 'ara' check (channel in ('ara','mesaj')),
  status text not null default 'yeni'
    check (status in ('yeni','acmadi','sonra_ara','red','toplanti','musteri')),
  call_back_at timestamptz,
  list_date date default current_date,
  sort_order int,
  notes text,
  source text default 'otomasyon',
  notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_assigned_status on public.leads(assigned_to, status);
create index if not exists leads_callback on public.leads(call_back_at) where status = 'sonra_ara';
create unique index if not exists leads_phone_unique on public.leads(phone) where phone is not null;

-- Arama kayıtları
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  outcome text not null check (outcome in ('acmadi','sonra_ara','red','toplanti')),
  note text,
  called_at timestamptz not null default now(),
  client_ref text unique  -- çevrimdışı senkronda çift kaydı önler
);
create index if not exists calls_user_day on public.calls(user_id, called_at);

-- Toplantılar
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  attendees uuid[] not null default '{}',
  scheduled_at timestamptz,
  duration_min int not null default 60,
  contact_name text,
  status text not null default 'planli'
    check (status in ('planli','yapildi','iptal','gelmedi')),
  result_entered boolean not null default false,
  prospect_reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_time on public.meetings(scheduled_at);

-- Satış takibi
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  caller_id uuid references public.profiles(id) on delete set null,
  stage text not null default 'toplanti'
    check (stage in ('toplanti','demo','teklif','dusunuyor','satis','kayip')),
  package text check (package in ('baslangic','profesyonel','kurumsal','ozel')),
  amount numeric(12,2),
  lost_reason text check (lost_reason in ('fiyat','gerek_yok','sahibi_yok','baska_firma','ulasilamadi','diger')),
  next_followup_at timestamptz,
  followup_step text default 'ara' check (followup_step in ('ara','cat_kapi')),
  commission_pct numeric(5,2) default 0,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at date not null default current_date,
  method text,
  note text,
  created_at timestamptz not null default now()
);

-- Bildirim altyapısı
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  url text,
  ref_id uuid,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_pending on public.notifications(send_after) where sent_at is null;

-- Eksik bilgili toplantılar
create or replace view public.meetings_missing as
  select m.*, l.business_name
  from public.meetings m join public.leads l on l.id = m.lead_id
  where m.status = 'planli' and (m.scheduled_at is null or coalesce(trim(m.contact_name),'') = '');

-- Sonucu girilmemiş, bitmiş toplantılar
create or replace view public.meetings_awaiting_result as
  select m.*, l.business_name
  from public.meetings m join public.leads l on l.id = m.lead_id
  where m.status = 'planli' and not m.result_entered
    and m.scheduled_at is not null
    and m.scheduled_at + make_interval(mins => m.duration_min) < now();

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists t_leads on public.leads;
create trigger t_leads before update on public.leads for each row execute function public.touch_updated_at();
drop trigger if exists t_meetings on public.meetings;
create trigger t_meetings before update on public.meetings for each row execute function public.touch_updated_at();
drop trigger if exists t_deals on public.deals;
create trigger t_deals before update on public.deals for each row execute function public.touch_updated_at();

-- Arama sonucu lead durumunu günceller; ✅ ise toplantı + satış kaydı açar
create or replace function public.on_call_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update leads set status = new.outcome where id = new.lead_id and status <> 'musteri';
  return new;
end $$;
drop trigger if exists t_calls on public.calls;
create trigger t_calls after insert on public.calls for each row execute function public.on_call_insert();

-- Toplantı açılınca satış kaydı aç
create or replace function public.on_meeting_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into deals(lead_id, meeting_id, owner_id, caller_id, stage)
  values (new.lead_id, new.id, new.created_by, new.created_by, 'toplanti');
  update leads set status = 'toplanti' where id = new.lead_id and status <> 'musteri';
  return new;
end $$;
drop trigger if exists t_meetings_ins on public.meetings;
create trigger t_meetings_ins after insert on public.meetings for each row execute function public.on_meeting_insert();

-- Yetki: sahipler her şeyi görür, arayanlar sadece kendine atananları
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'owner')
$$;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.calls enable row level security;
alter table public.meetings enable row level security;
alter table public.deals enable row level security;
alter table public.payments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists p_profiles on public.profiles;
create policy p_profiles on public.profiles for select to authenticated using (true);
drop policy if exists p_profiles_self on public.profiles;
create policy p_profiles_self on public.profiles for update to authenticated using (id = auth.uid() or public.is_owner());

drop policy if exists p_leads on public.leads;
create policy p_leads on public.leads for all to authenticated
  using (public.is_owner() or assigned_to = auth.uid())
  with check (public.is_owner() or assigned_to = auth.uid());

drop policy if exists p_calls on public.calls;
create policy p_calls on public.calls for all to authenticated
  using (public.is_owner() or user_id = auth.uid())
  with check (public.is_owner() or user_id = auth.uid());

drop policy if exists p_meetings on public.meetings;
create policy p_meetings on public.meetings for all to authenticated
  using (public.is_owner() or created_by = auth.uid() or auth.uid() = any(attendees))
  with check (public.is_owner() or created_by = auth.uid());

drop policy if exists p_deals on public.deals;
create policy p_deals on public.deals for all to authenticated
  using (public.is_owner() or caller_id = auth.uid())
  with check (public.is_owner());

drop policy if exists p_payments on public.payments;
create policy p_payments on public.payments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists p_push on public.push_subscriptions;
create policy p_push on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_notif on public.notifications;
create policy p_notif on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists p_notif_read on public.notifications;
create policy p_notif_read on public.notifications for update to authenticated using (user_id = auth.uid());

alter view public.meetings_missing set (security_invoker = on);
alter view public.meetings_awaiting_result set (security_invoker = on);
