create or replace function public.send_test_notification() returns void language sql security definer set search_path = public as $$
  insert into notifications(user_id, kind, title, body, url)
  values (auth.uid(), 'test', 'Bildirimler açık ✅', 'Toplantı, takip ve maraton bildirimleri buraya gelecek.', '/');
$$;
revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
