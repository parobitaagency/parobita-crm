create or replace function widget_data(t text) returns json language plpgsql security definer set search_path=public as $$
declare uid uuid := sc_uid(t);
  loc timestamp := now() at time zone 'Europe/Istanbul';
  som timestamptz := date_trunc('month', loc) at time zone 'Europe/Istanbul';
  psom timestamptz := (date_trunc('month', loc) - interval '1 month') at time zone 'Europe/Istanbul';
  r json;
begin
  select json_build_object(
    'now', to_char(loc, 'HH24:MI'),
    'me', (select full_name from profiles where id = uid),
    'rivals', (select json_agg(json_build_object('name', split_part(full_name,' ',1), 'me', id = uid, 'today', today_calls, 'week', week_calls, 'meet', week_meetings, 'ezik', ezik) order by id <> uid) from rivalry),
    'queue', (select count(*) from leads where assigned_to = uid and phone is not null and (status in ('yeni','acmadi') or (status='sonra_ara' and call_back_at <= now()))),
    'next_leads', (select coalesce(json_agg(x), '[]') from (
        select business_name name, coalesce(niche,'') niche, coalesce(district,'') district, status from leads
        where assigned_to = uid and phone is not null and (status in ('yeni','acmadi') or (status='sonra_ara' and call_back_at <= now()))
        order by case when status='sonra_ara' then 0 when status='yeni' then 1 else 2 end, list_date nulls last, sort_order nulls last limit 8) x),
    'meetings', (select coalesce(json_agg(x), '[]') from (
        select l.business_name name, m.scheduled_at at, coalesce(m.contact_name,'') contact, coalesce(l.district,'') district from meetings m join leads l on l.id=m.lead_id
        where m.status='planli' and m.scheduled_at >= now() - interval '1 hour' and (m.created_by = uid or uid = any(m.attendees))
        order by m.scheduled_at limit 6) x),
    'events', (select coalesce(json_agg(x), '[]') from (
        select title name, starts_at at from events where starts_at >= now() - interval '1 hour' and starts_at < now() + interval '7 days' order by starts_at limit 4) x),
    'cal', (select coalesce(json_agg(x order by x.at), '[]') from (
        select 'toplanti' kind, 'Toplantı · ' || l.business_name name, m.scheduled_at at, m.scheduled_at + make_interval(mins => m.duration_min) until, coalesce(l.district,'') place
          from meetings m join leads l on l.id=m.lead_id
          where m.status in ('planli','yapildi') and m.scheduled_at >= date_trunc('day', loc) at time zone 'Europe/Istanbul' and m.scheduled_at < now() + interval '14 days'
            and (m.created_by = uid or uid = any(m.attendees))
        union all
        select 'etkinlik', e.title, e.starts_at, e.ends_at, coalesce(e.location,'') from events e
          where e.starts_at >= date_trunc('day', loc) at time zone 'Europe/Istanbul' and e.starts_at < now() + interval '14 days'
        limit 40) x),
    'rev_month', (select coalesce(sum(amount),0) from deals where stage='satis' and closed_at >= som),
    'rev_prev', (select coalesce(sum(amount),0) from deals where stage='satis' and closed_at >= psom and closed_at < som),
    'sales_month', (select count(*) from deals where stage='satis' and closed_at >= som),
    'rev_total', (select coalesce(sum(amount),0) from deals where stage='satis'),
    'collected_month', (select coalesce(sum(amount),0) from payments where paid_at >= som::date),
    'open_deals', (select count(*) from deals where stage in ('toplanti','demo','teklif','dusunuyor')),
    'last_sales', (select coalesce(json_agg(x), '[]') from (
        select l.business_name name, d.amount, d.closed_at at from deals d join leads l on l.id=d.lead_id where d.stage='satis' order by d.closed_at desc limit 3) x),
    'days', (select json_agg(coalesce(s,0) order by dd) from (
        select dd, (select sum(amount) from deals where stage='satis' and (closed_at at time zone 'Europe/Istanbul')::date = dd) s
        from generate_series(date_trunc('month', loc)::date, loc::date, interval '1 day') dd) z)
  ) into r;
  return r;
end $$;
revoke all on function widget_data from public; grant execute on function widget_data to anon;
notify pgrst, 'reload schema';
