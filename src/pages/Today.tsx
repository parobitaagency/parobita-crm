import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS, supabase, waLink, type Lead, type Meeting } from '../lib/supabase'
import { useSession } from '../lib/session'
import { MeetingRow } from './Meetings'
import MeetingPanel from '../components/MeetingPanel'
import LeadPanel from '../components/LeadPanel'
import Rivalry from '../components/Rivalry'
import PushToggle from '../components/PushToggle'

const SEL = '*, leads(business_name, phone, address, district, maps_url, lat, lng)'

export default function Today() {
  const { me, badges } = useSession()
  const [stats, setStats] = useState({ calls: 0, meetingsBooked: 0, left: 0 })
  const [today, setToday] = useState<Meeting[]>([])
  const [callbacks, setCallbacks] = useState<Lead[]>([])
  const [wa, setWa] = useState<Lead[]>([])
  const [openM, setOpenM] = useState<Meeting | null>(null)
  const [openL, setOpenL] = useState<Lead | null>(null)

  const load = useCallback(async () => {
    if (!me) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 86400000)
    const [c, mb, left, mt, cb, w] = await Promise.all([
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('user_id', me.id).gte('called_at', start.toISOString()),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('outcome', 'toplanti').gte('called_at', start.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', me.id).in('status', ['yeni', 'acmadi']),
      supabase.from('meetings').select(SEL).eq('status', 'planli').gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).order('scheduled_at'),
      supabase.from('leads').select('*').eq('assigned_to', me.id).in('status', ['sonra_ara', 'wp', 'uzun_vade']).lte('call_back_at', end.toISOString()).order('call_back_at'),
      supabase.from('leads').select('*').eq('assigned_to', me.id).eq('status', 'wp').is('wa_sent_at', null).order('updated_at', { ascending: false }),
    ])
    setStats({ calls: c.count ?? 0, meetingsBooked: mb.count ?? 0, left: left.count ?? 0 })
    setToday((mt.data ?? []) as Meeting[])
    setCallbacks((cb.data ?? []) as Lead[])
    setWa((w.data ?? []) as Lead[])
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

      <PushToggle />

      <a className="btn primary big" style={{ width: '100%', marginBottom: 12, marginTop: 8 }} href="shortcuts://run-shortcut?name=Parobita%20Ara">▶ Arama seansı başlat</a>

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

      <Rivalry />

      {wa.length > 0 && (
        <>
          <h2 className="section">📲 WhatsApp’tan bilgi bekleyenler <span className="n">{wa.length}</span></h2>
          <div className="list">{wa.map((l) => (
            <div key={l.id} className="item">
              <div className="grow" onClick={() => setOpenL(l)}><div className="t">{l.business_name}</div><div className="s">{[l.district, l.phone].filter(Boolean).join(' · ')}</div></div>
              <a className="btn primary" href={waLink(l.phone, me?.full_name.split(' ')[0] ?? '')} target="_blank" rel="noreferrer"
                onClick={() => { supabase.from('leads').update({ wa_sent_at: new Date().toISOString() }).eq('id', l.id).then(() => setWa((x) => x.filter((y) => y.id !== l.id))) }}>💬 Gönder</a>
            </div>
          ))}</div>
        </>
      )}

      <h2 className="section">Bugünkü toplantılar <span className="n">{today.length}</span></h2>
      {today.length ? <div className="list">{today.map((m) => <MeetingRow key={m.id} m={m} onClick={() => setOpenM(m)} />)}</div>
        : <div className="empty">Bugün toplantı yok.</div>}

      <h2 className="section">Bugün tekrar aranacaklar <span className="n">{callbacks.length}</span></h2>
      {callbacks.length ? (
        <div className="list">{callbacks.map((l) => (
          <div key={l.id} className="item" onClick={() => setOpenL(l)}>
            <span className="time">{l.call_back_at ? new Date(l.call_back_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <div className="grow"><div className="t">{l.business_name}</div><div className="s">{STATUS[l.status].icon} {STATUS[l.status].label}{l.notes ? ' · ' + l.notes.split('\n')[0] : ''}</div></div>
          </div>
        ))}</div>
      ) : <div className="empty">Bugün tekrar aranacak kimse yok.</div>}

      <div className="divider" style={{ marginTop: 40 }} />
      <div className="faint" style={{ fontSize: 13, display: 'flex', gap: 16 }}>
        <a href="#" onClick={async (e) => {
          e.preventDefault()
          const pw = prompt('Yeni şifre (en az 8 karakter):')
          if (!pw) return
          if (pw.length < 8) return alert('Şifre en az 8 karakter olmalı.')
          const { error } = await supabase.auth.updateUser({ password: pw })
          alert(error ? 'Olmadı: ' + error.message : 'Şifre değişti.')
        }}>Şifreyi değiştir</a>
        <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }}>Çıkış yap</a>
      </div>

      {openM && <MeetingPanel meeting={openM} onClose={() => setOpenM(null)} onSaved={load} />}
      {openL && <LeadPanel lead={openL} onClose={() => setOpenL(null)} onSaved={() => load()} />}
    </div>
  )
}
