-- Sohbetten satış/ödeme kaydı: "X'ten 5.000 aldık" gibi
create or replace function bot_record_sale(t text, name text, amount numeric default null, paid numeric default 0,
  on_date date default null, pkg text default null, who text default 'burak', note text default null) returns json
language plpgsql security definer set search_path=public as $$
declare lid uuid; did uuid; uid uuid; d date := coalesce(on_date, (now() at time zone 'Europe/Istanbul')::date); created boolean := false;
begin perform bot_ok(t);
  uid := (select p.id from profiles p join auth.users u on u.id=p.id where u.email like case lower(who) when 'korhan' then 'korhan%' else 'burak%' end limit 1);
  select id into lid from leads where lower(business_name) = lower(bot_record_sale.name) limit 1;
  if lid is null then select id into lid from leads where business_name ilike '%' || bot_record_sale.name || '%' and source <> 'test' order by (status='musteri') desc limit 1; end if;
  if lid is null then
    insert into leads(assigned_to,business_name,status,channel,source,notes) values(uid,bot_record_sale.name,'musteri','ara','manuel',bot_record_sale.note) returning id into lid; created := true;
  end if;
  update leads set status='musteri' where id=lid;
  select id into did from deals where lead_id=lid order by created_at desc limit 1;
  if did is null then
    insert into deals(lead_id,owner_id,caller_id,stage,package,amount,closed_at,notes) values(lid,uid,uid,'satis',pkg,bot_record_sale.amount,(d::text||' 12:00+03')::timestamptz,bot_record_sale.note) returning id into did;
  else
    update deals set stage='satis', package=coalesce(pkg,package), amount=coalesce(bot_record_sale.amount,deals.amount),
      closed_at=coalesce(closed_at,(d::text||' 12:00+03')::timestamptz), next_followup_at=null,
      notes=concat_ws(E'\n',notes,bot_record_sale.note) where id=did;
  end if;
  if coalesce(paid,0) > 0 then insert into payments(deal_id,amount,paid_at,note) values(did,bot_record_sale.paid,d,bot_record_sale.note); end if;
  return json_build_object('lead',(select business_name from leads where id=lid),'new_lead',created,
    'amount',(select dd.amount from deals dd where dd.id=did),'paid_total',(select coalesce(sum(p.amount),0) from payments p where p.deal_id=did));
end $$;
revoke all on function bot_record_sale from public; grant execute on function bot_record_sale to anon;
notify pgrst, 'reload schema';
