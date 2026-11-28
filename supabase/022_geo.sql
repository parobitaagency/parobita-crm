alter table leads add column if not exists lat double precision, add column if not exists lng double precision, add column if not exists geo_level text;
create table if not exists geo_cache(q text primary key, lat double precision, lng double precision, created_at timestamptz default now());
alter table geo_cache enable row level security; revoke all on geo_cache from anon, authenticated;
create table if not exists app_settings(id int primary key default 1, base_name text, base_lat double precision, base_lng double precision);
alter table app_settings enable row level security; grant select on app_settings to authenticated;
drop policy if exists s_read on app_settings; create policy s_read on app_settings for select to authenticated using (true);
alter table profiles add column if not exists call_prefs jsonb default '{}'::jsonb;
create or replace function km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) returns double precision
language sql immutable as $$
  select case when lat1 is null or lat2 is null then null else
    6371 * 2 * asin(sqrt(power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2))) end
$$;
create or replace function public.call_geocode() returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from leads where geo_level is null or geo_level = 'district') then return; end if;
  perform net.http_post(
    url := 'https://lzxkowlecpiwvbwrjqxs.supabase.co/functions/v1/geocode',
    headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
end $function$;
select cron.schedule('geocode', '*/2 * * * *', 'select public.call_geocode()');
