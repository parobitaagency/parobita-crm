CREATE OR REPLACE FUNCTION public.call_queue(uid uuid, lim integer DEFAULT 400, horizon interval DEFAULT '00:00:00'::interval)
 RETURNS SETOF leads
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.* from leads l
  join profiles p on p.id = uid
  left join app_settings s on s.id = 1
  where l.assigned_to = uid and l.phone is not null 
    and (l.status in ('yeni','acmadi') or (l.status in ('sonra_ara','wp','uzun_vade') and l.call_back_at <= now() + horizon))
    and (coalesce(p.call_prefs->>'niche','') = '' or l.niche = p.call_prefs->>'niche')
    and (coalesce(p.call_prefs->>'district','') = '' or l.district ilike '%' || (p.call_prefs->>'district') || '%')
    and (jsonb_array_length(coalesce(p.call_prefs->'statuses','[]'::jsonb)) = 0
         or l.status in (select jsonb_array_elements_text(p.call_prefs->'statuses')))
  order by
    (l.source = 'test') desc,
    case when l.status in ('sonra_ara','wp','uzun_vade') then 0 else 1 end,
    case when p.call_prefs->>'sort' = 'yakin' then km(coalesce((p.call_prefs->>'olat')::float8, s.base_lat), coalesce((p.call_prefs->>'olng')::float8, s.base_lng), l.lat, l.lng) end nulls last,
    case p.call_prefs->>'sort' when 'puan' then -l.rating when 'yorum' then -l.review_count end nulls last,
    case when p.call_prefs->>'sort' = 'isim' then l.business_name end,
    case when l.status = 'yeni' then 1 else 2 end, l.list_date nulls last, l.sort_order nulls last
  limit lim
$function$

;
