-- Kaçışta seviyeyi bağıran bildirim + gerçek kişilerden sözler
create or replace function public.level_shout(n int) returns text language sql immutable as $$
  select case
    when n <= 0 then 'MİLYARDERSİN 💰'
    when n = 1 then 'BAHANECİSİN! 😐'
    when n = 2 then 'KAPLUMBAĞASIN! 🐢'
    when n = 3 then 'KOLTUK PEZEVENGİSİN! 🛋️'
    else 'FAKİRSİN! 🤡' end
$$;
create or replace function public.level_name(n int) returns text language sql immutable as $$
  select case
    when n <= 0 then 'Milyarder' when n = 1 then 'Bahaneci' when n = 2 then 'Kaplumbağa'
    when n = 3 then 'Koltuk Pezevengi' else 'Fakir' end
$$;

create or replace function public.detect_escapes() returns int language plpgsql security definer set search_path = public as $$
declare m record; n int := 0; who text; lvl int;
begin
  for m in select * from marathons
           where finished_at is null and last_activity_at < now() - interval '10 minutes'
  loop
    update marathons set finished_at = now(), abandoned = true where id = m.id;
    select full_name into who from profiles where id = m.user_id;
    select ezik into lvl from rivalry where id = m.user_id;
    -- kaçana: seviyesini bağır
    insert into notifications(user_id, kind, title, body, url)
    values (m.user_id, 'kacis', level_shout(lvl), 'Maratondan kaçtın: ' || m.done || '/' || m.target || '. Bunu herkes gördü.', '/');
    -- diğerlerine: 😂
    insert into notifications(user_id, kind, title, body, url)
    select p.id, 'kacis', split_part(who, ' ', 1) || ' maratondan kaçtı 😂',
           m.done || '/' || m.target || '''de bıraktı. Yeni unvanı: ' || upper(level_name(lvl)) || ' 😂', '/'
      from profiles p where p.id <> m.user_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.detect_escapes() from public, anon, authenticated;

alter table public.quotes add column if not exists author text;
update public.quotes set active = false where kind = 'sert';
delete from public.quotes where kind = 'klasik';
insert into public.quotes(text, author, kind) values
 ('Zafer, "zafer benimdir" diyebilenindir. Başarı, "başaracağım" diye başlayanın ve "başardım" diyebilenindir.', 'Atatürk', 'klasik'),
 ('Muhtaç olduğun kudret, damarlarındaki asil kanda mevcuttur.', 'Atatürk', 'klasik'),
 ('Dünyada her şey için, başarı için en hakiki mürşit ilimdir, fendir.', 'Atatürk', 'klasik'),
 ('Hiçbir şeye ihtiyacımız yok, yalnız bir şeye ihtiyacımız vardır: Çalışkan olmak.', 'Atatürk', 'klasik'),
 ('Allah''a dayan, sa''ye sarıl, hikmete râm ol. Yol bu. Doğru yol bu. Başka yolu yoktur.', 'Mehmet Akif Ersoy', 'klasik'),
 ('Âtîyi karanlık görerek azmi bırakmak, alçak bir ölümdür ki yazık ondan ürkmez!', 'Mehmet Akif Ersoy', 'klasik'),
 ('Ya ben İstanbul''u alırım, ya İstanbul beni.', 'Fatih Sultan Mehmet', 'klasik'),
 ('Dâhilik yüzde bir ilham, yüzde doksan dokuz terdir.', 'Thomas Edison', 'klasik'),
 ('Atmadığın şutların yüzde yüzünü kaçırırsın.', 'Wayne Gretzky', 'klasik'),
 ('Antrenmanın her dakikasından nefret ettim ama dedim ki: Bırakma. Şimdi acı çek, ömrünün geri kalanını şampiyon olarak yaşa.', 'Muhammad Ali', 'klasik'),
 ('Aç kalın, budala kalın.', 'Steve Jobs', 'klasik'),
 ('Elindekiyle, bulunduğun yerde, yapabileceğini yap.', 'Theodore Roosevelt', 'klasik'),
 ('Neden azmin bu kadar süreksiz? Sen mi yüreksizsin, yoksa davan mı?', null, 'klasik');

-- Başlık ve günlük motivasyon: söz + sahibi
create or replace function public.quote_line() returns text language sql volatile security definer set search_path = public as $$
  select '“' || text || '”' || coalesce(' — ' || author, '') from quotes where active order by random() limit 1
$$;
create or replace function public.sc_header(uid uuid) returns text
language sql volatile security definer set search_path = public as $$
  select concat(
    'Bugün ', (select count(*) from calls where user_id = uid and called_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
    ' arama · ', (select count(*) from calls where user_id = uid and outcome = 'toplanti' and called_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
    ' toplantı', E'\n\n', quote_line())
$$;
