alter table public.leads add column if not exists served_at timestamptz;
alter table public.leads add column if not exists served_by uuid;

create or replace function public.sc_next(t text, skip uuid[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := sc_uid(t); r leads; pending boolean := false;
begin
  perform touch_marathon_uid(uid);
  -- Önce sonucu girilmemiş, az önce aranmış lead var mı?
  select * into r from leads l
   where l.served_by = uid and l.served_at > now() - interval '3 hours'
     and not exists (select 1 from calls c where c.lead_id = l.id and c.called_at >= l.served_at)
   order by l.served_at desc limit 1;
  if r.id is not null then
    pending := true;
  else
    select * into r from leads
     where assigned_to = uid and phone is not null and not (id = any(skip))
       and (status in ('yeni','acmadi') or (status = 'sonra_ara' and call_back_at <= now()))
       and not exists (select 1 from calls c where c.lead_id = leads.id and c.called_at > now() - interval '3 hours')
     order by case when status = 'sonra_ara' then 0 when status = 'yeni' then 1 else 2 end,
              list_date nulls last, sort_order nulls last
     limit 1;
    if r.id is null then
      return json_build_object('done', true, 'pending', 0, 'id', '', 'name', 'Liste bitti', 'phone', '', 'header', sc_header(uid));
    end if;
    update leads set served_at = now(), served_by = uid where id = r.id;
  end if;
  return json_build_object('done', false, 'pending', case when pending then 1 else 0 end,
    'id', r.id, 'name', r.business_name, 'phone', r.phone,
    'info', concat_ws(' · ', r.niche, r.district, case when r.rating is not null then '★ ' || r.rating end),
    'address', coalesce(r.address, r.district, ''),
    'header', sc_header(uid));
end $$;
grant execute on function public.sc_next(text, uuid[]) to anon, authenticated;
