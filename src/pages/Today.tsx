import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Lead, type Meeting } from '../lib/supabase'
import { useSession } from '../lib/session'
import { MeetingRow } from './Meetings'
import MeetingPanel from '../components/MeetingPanel'
import LeadPanel from '../components/LeadPanel'

const SEL = '*, leads(business_name, phone, address, district, maps_url)'

export default function Today() {
  const { me, badges } = useSession()
  const [stats, setStats] = useState({ calls: 0, meetingsBooked: 0, left: 0 })
  const [today, setToday] = useState<Meeting[]>([])
  const [callbacks, setCallbacks] = useState<Lead[]>([])
  const [openM, setOpenM] = useState<Meeting | null>(null)
  const [openL, setOpenL] = useState<Lead | null>(null)

  const load = useCallback(async () => {
    if (!me) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 86400000)
    const [c, mb, left, mt, cb] = await Promise.all([
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('user_id', me.id).gte('called_at', start.toISOString()),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('outcome', 'toplanti').gte('called_at', start.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', me.id).in('status', ['yeni', 'acmadi']),
      supabase.from('meetings').select(SEL).eq('status', 'planli').gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).order('scheduled_at'),
      supabase.from('leads').select('*').eq('assigned_to', me.id).eq('status', 'sonra_ara').lte('call_back_at', end.toISOString()).order('call_back_at'),
    ])
    setStats({ calls: c.count ?? 0, meetingsBooked: mb.count ?? 0, left: left.count ?? 0 })
    setToday((mt.data ?? []) as Meeting[])
    setCallbacks((cb.data ?? []) as Lead[])
  }, [me])
  useEffect(() => { load() }, [load])

  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-icon">☀︎</div>
        <h1 className="title">{hello}, {me?.full_name.split(' ')[0]}</h1>
        <div className="subtitle">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>

      {(badges.missing > 0 || badges.awaiting > 0) && (
        <Link to="/toplantilar" style={{ textDecoration: 'none' }}>
          <div className="callout"><span className="ic">⚠️</span><div>
            {badges.missing > 0 && <div><b>{badges.missing} toplantıda eksik bilgi</b> var.</div>}
            {badges.awaiting > 0 && <div><b>{badges.awaiting} toplantının sonucu</b> girilmedi.</div>}
          </div></div>
        </Link>
      )}

      <div className="stats">
        <div className="stat"><div className="k">Bugün arama</div><div className="v">{stats.calls}</div></div>
        <div className="stat"><div className="k">Bugün toplantı aldın</div><div className="v">{stats.meetingsBooked}</div></div>
        <div className="stat"><div className="k">Bugünkü toplantılar</div><div className="v">{today.length}</div></div>
        <div className="stat"><div className="k">Aranacak lead</div><div className="v">{stats.left}</div></div>
      </div>

      <h2 className="section">Bugünkü toplantılar <span className="n">{today.length}</span></h2>
      {today.length ? <div className="list">{today.map((m) => <MeetingRow key={m.id} m={m} onClick={() => setOpenM(m)} />)}</div>
        : <div className="empty">Bugün toplantı yok.</div>}

      <h2 className="section">Bugün tekrar aranacaklar <span className="n">{callbacks.length}</span></h2>
      {callbacks.length ? (
        <div className="list">{callbacks.map((l) => (
          <div key={l.id} className="item" onClick={() => setOpenL(l)}>
            <span className="time">{l.call_back_at ? new Date(l.call_back_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <div className="grow"><div className="t">{l.business_name}</div><div className="s">{l.notes?.split('\n')[0] ?? ''}</div></div>
          </div>
        ))}</div>
      ) : <div className="empty">Bugün tekrar aranacak kimse yok.</div>}

      {openM && <MeetingPanel meeting={openM} onClose={() => setOpenM(null)} onSaved={load} />}
      {openL && <LeadPanel lead={openL} onClose={() => setOpenL(null)} onSaved={() => load()} />}
    </div>
  )
}
