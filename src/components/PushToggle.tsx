import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

const VAPID = 'BCAgnW_9Z0EB5tIuUhOK-gW_b-TmC9f2nk2N0yHgZD0NB_DHwOO3oxNkY9mt6giyrQ4yTsICnSQzGGWywWq-diA'

const toKey = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type State = 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied' | 'busy'

export default function PushToggle() {
  const { me } = useSession()
  const [state, setState] = useState<State>('busy')

  useEffect(() => {
    ;(async () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState(standalone ? 'unsupported' : 'needs-install')
      if (Notification.permission === 'denied') return setState('denied')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })()
  }, [])

  const enable = async () => {
    if (!me) return
    setState('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off')
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID) }))
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await supabase.from('push_subscriptions').upsert({ user_id: me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
      await supabase.rpc('send_test_notification')
      setState('on')
    } catch (e) {
      alert('Bildirim açılamadı: ' + (e as Error).message)
      setState('off')
    }
  }

  if (state === 'on' || state === 'busy') return null
  return (
    <div className="callout neutral" style={{ alignItems: 'center' }}>
      <span className="ic">🔔</span>
      <div style={{ flex: 1 }}>
        {state === 'needs-install' && <>Bildirimler için uygulamayı ana ekrana ekleyip oradan aç.</>}
        {state === 'unsupported' && <>Bu cihaz bildirimleri desteklemiyor.</>}
        {state === 'denied' && <>Bildirimler kapalı. Ayarlar → Bildirimler → Parobita'dan aç.</>}
        {state === 'off' && <>Toplantı, takip ve maraton bildirimlerini al.</>}
      </div>
      {state === 'off' && <button className="btn primary" onClick={enable}>Bildirimleri aç</button>}
    </div>
  )
}
