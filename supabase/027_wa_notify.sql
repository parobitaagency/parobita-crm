create or replace function wa_notifications() returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select l.id, l.business_name, l.assigned_to from leads l
            where l.status = 'wp' and l.wa_sent_at is null and l.assigned_to is not null
              and l.updated_at < now() - interval '3 minutes' and l.updated_at > now() - interval '7 days' loop
    perform notify(array[r.assigned_to], 'takip', '📲 WhatsApp’tan bilgi at',
      r.business_name || ' WhatsApp’tan bilgi istedi. CRM’de “WhatsApp’ta aç”a bas, mesaj hazır.', '/', 'wa-' || r.id, null);
  end loop;
end $$;
select cron.schedule('wa_notifications', '*/5 * * * *', 'select wa_notifications()');
