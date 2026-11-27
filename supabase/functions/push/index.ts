// Bekleyen bildirimleri Web Push ile gönderir. pg_cron her dakika çağırır.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails('mailto:burak@parobita.com', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!)

function quietNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')!.value), m = Number(parts.find((p) => p.type === 'minute')!.value)
  const mins = h * 60 + m
  return mins >= 22 * 60 + 30 || mins < 8 * 60 + 30
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('yetkisiz', { status: 401 })
  // Sessiz saatlerde (22:30–08:30) sadece test bildirimi gider, gerisi sabahı bekler
  let query = sb.from('notifications').select('*').is('sent_at', null).lte('send_after', new Date().toISOString()).order('created_at').limit(100)
  if (quietNow()) query = query.eq('kind', 'test')
  const { data: due } = await query
  let sent = 0
  for (const n of due ?? []) {
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', n.user_id)
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body ?? '', url: n.url ?? '/', tag: n.kind + (n.ref_id ?? '') }),
          { TTL: 86400 },
        )
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
    await sb.from('notifications').update({ sent_at: new Date().toISOString() }).eq('id', n.id)
  }
  return Response.json({ sent, checked: due?.length ?? 0 })
})
