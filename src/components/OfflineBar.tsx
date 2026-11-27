import { useEffect, useState } from 'react'
import { flushQueue, onQueueChange, queueLength } from '../lib/offline'

export default function OfflineBar() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(queueLength())
  useEffect(() => {
    const up = () => { setOnline(true); flushQueue() }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    const off = onQueueChange(() => setPending(queueLength()))
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); off() }
  }, [])
  if (online && pending === 0) return null
  return (
    <div className="offline-bar">
      {!online ? 'Çevrimdışı · son kaydedilen veriler gösteriliyor' : 'Gönderiliyor…'}
      {pending > 0 && <> · {pending} kayıt bekliyor</>}
    </div>
  )
}
