import { useCallback, useEffect, useState } from 'react'
import { fmtTime, supabase, type Meeting } from '../lib/supabase'
import MeetingPanel from '../components/MeetingPanel'
import CalendarView from '../components/CalendarView'

const SEL = '*, leads(business_name, phone, address, district, maps_url)'

const dayLabel = (d: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  const diff = Math.round((x.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Yarın'
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function MeetingRow({ m, onClick, showDay }: { m: Meeting; onClick: () => void; showDay?: boolean }) {
  const missing = !m.scheduled_at || !(m.contact_name ?? '').trim()
  return (
    <div className="item" onClick={onClick}>
      <span className="time">{m.scheduled_at ? (showDay ? new Date(m.scheduled_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : fmtTime(m.scheduled_at)) : '—'}</span>
      <div className="grow">
        <div className="t">{m.leads?.business_name}</div>
        <div className="s">{[m.contact_name, m.leads?.district].filter(Boolean).join(' · ') || ' '}</div>
      </div>
      {missing && m.status === 'planli' && <span className="tag red">⚠️ Eksik</span>}
    </div>
  )
}

export default function Meetings() {
  const [missing, setMissing] = useState<Meeting[]>([])
  const [awaiting, setAwaiting] = useState<Meeting[]>([])
  const [upcoming, setUpcoming] = useState<Meeting[]>([])
  const [open, setOpen] = useState<Meeting | null>(null)
  const [tab, setTab] = useState<'liste' | 'takvim'>(() => (localStorage.getItem('pb-meet-tab') as 'liste' | 'takvim') ?? 'liste')
  const pick = (t: 'liste' | 'takvim') => { setTab(t); try { localStorage.setItem('pb-meet-tab', t) } catch { /* */ } }

  const load = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const [a, b] = await Promise.all([
      supabase.from('meetings').select(SEL).eq('status', 'planli').order('scheduled_at', { nullsFirst: true }),
      supabase.from('meetings_awaiting_result').select('id'),
    ])
    const all = (a.data ?? []) as Meeting[]
    const awaitIds = new Set((b.data ?? []).map((x) => x.id))
    setMissing(all.filter((m) => !m.scheduled_at || !(m.contact_name ?? '').trim()))
    setAwaiting(all.filter((m) => awaitIds.has(m.id)))
    setUpcoming(all.filter((m) => m.scheduled_at && !awaitIds.has(m.id) && new Date(m.scheduled_at) >= start))
  }, [])

  useEffect(() => { load() }, [load])

  const groups = upcoming.reduce<Record<string, Meeting[]>>((acc, m) => {
    const k = dayLabel(new Date(m.scheduled_at!)); (acc[k] ||= []).push(m); return acc
  }, {})

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-icon">◷</div>
        <h1 className="title">Toplantılar</h1>
        <div className="subtitle">{upcoming.length} yaklaşan</div>
      </div>

      <div className="toolbar">
        <button className={'tab' + (tab === 'liste' ? ' on' : '')} onClick={() => pick('liste')}>Liste</button>
        <button className={'tab' + (tab === 'takvim' ? ' on' : '')} onClick={() => pick('takvim')}>Takvim</button>
      </div>

      {tab === 'takvim' && <CalendarView onOpen={setOpen} />}
      {tab === 'liste' && <>

      {missing.length > 0 && (
        <>
          <div className="callout"><span className="ic">⚠️</span><div><b>{missing.length} toplantıda eksik bilgi var.</b> Saat ya da yetkili adı girilmemiş.</div></div>
          <div className="list">{missing.map((m) => <MeetingRow key={m.id} m={m} showDay onClick={() => setOpen(m)} />)}</div>
        </>
      )}

      {awaiting.length > 0 && (
        <>
          <h2 className="section">Nasıl geçti? <span className="n">{awaiting.length}</span></h2>
          <div className="list">{awaiting.map((m) => <MeetingRow key={m.id} m={m} showDay onClick={() => setOpen(m)} />)}</div>
        </>
      )}

      {Object.entries(groups).map(([day, ms]) => (
        <div key={day}>
          <h2 className="section">{day} <span className="n">{ms.length}</span></h2>
          <div className="list">{ms.map((m) => <MeetingRow key={m.id} m={m} onClick={() => setOpen(m)} />)}</div>
        </div>
      ))}
      {upcoming.length === 0 && missing.length === 0 && awaiting.length === 0 && <div className="empty">Planlı toplantı yok.</div>}
      </>}

      {open && <MeetingPanel meeting={open} onClose={() => setOpen(null)} onSaved={load} />}
    </div>
  )
}
