create table if not exists public.quotes (
  id serial primary key,
  text text not null,
  kind text not null default 'sert' check (kind in ('sert','klasik')),
  active boolean not null default true
);
alter table public.quotes enable row level security;
drop policy if exists p_quotes on public.quotes;
create policy p_quotes on public.quotes for select to authenticated using (true);

insert into public.quotes(text, kind) values
 ('Noldu, para kazanmaya ihtiyacın olduğu mu aklına geldi?', 'sert'),
 ('Yapamazsın ki. Götün yemez. Kanıtla bakalım.', 'sert'),
 ('Sen tembelsin. Sonraki aramada göster tersini.', 'sert'),
 ('Dün de yarın demiştin. Bugün o yarın.', 'sert'),
 ('1 milyon TL kendiliğinden gelmiyor. Bir sonrakini ara.', 'sert'),
 ('Retten korkan satış yapamaz. Korkuyor musun?', 'sert'),
 ('Bahaneni söyle, ben de dinlemeyeyim.', 'sert'),
 ('Rakiplerin şu an arıyor. Sen ne yapıyorsun?', 'sert'),
 ('Her ret seni bir satışa yaklaştırıyor. Saymaya devam.', 'sert'),
 ('Konfor alanın seni zengin etmeyecek.', 'sert'),
 ('Herkes plan yapar, az kişi arar. Hangisisin?', 'sert'),
 ('Telefon ağır değil. Ağır olan senin bahanelerin.', 'sert'),
 ('Bir arama daha. Sonra bir tane daha. Satış böyle gelir.', 'sert'),
 ('Bugün aramadığın her işletme, başkasının müşterisi olacak.', 'sert'),
 ('Yorulduysan dinlenme, sadece bir sonrakini ara.', 'sert'),
 ('Hayatta en hakiki mürşit ilimdir. — Atatürk', 'klasik'),
 ('Ne mutlu Türküm diyene. — Atatürk', 'klasik'),
 ('Hiçbir şey bilmiyorsak, bilmediğimizi bilelim. — Atatürk', 'klasik')
on conflict do nothing;

create or replace function public.sc_header(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select concat(
    'Bugün ', (select count(*) from calls where user_id = uid and called_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
    ' arama · ', (select count(*) from calls where user_id = uid and outcome = 'toplanti' and called_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
    ' toplantı', E'\n\n', '“', (select text from quotes where active order by random() limit 1), '”')
$$;

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
  if r.id is null then return json_build_object('done', true, 'id', '', 'name', 'Liste bitti', 'phone', '', 'header', sc_header(uid)); end if;
  return json_build_object('done', false, 'id', r.id, 'name', r.business_name, 'phone', r.phone,
    'info', concat_ws(' · ', r.niche, r.district, case when r.rating is not null then '★ ' || r.rating end),
    'address', coalesce(r.address, r.district, ''),
    'header', sc_header(uid));
end $$;
grant execute on function public.sc_next(text, uuid[]) to anon, authenticated;
