import { useState } from 'react'
import Panel, { Prop, fromLocalInput } from './Panel'
import { STATUS, supabase, telHref, type Lead, type LeadStatus } from '../lib/supabase'
import { useSession } from '../lib/session'

type Outcome = 'acmadi' | 'sonra_ara' | 'red' | 'toplanti'
const OUTCOMES: { k: Outcome; e: string; l: string }[] = [
  { k: 'toplanti', e: '✅', l: 'Toplantı' },
  { k: 'red', e: '❌', l: 'Red' },
  { k: 'acmadi', e: '⏸️', l: 'Açmadı' },
  { k: 'sonra_ara', e: '⚠️', l: 'Sonra ara' },
]

export default function LeadPanel({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: (l: Lead) => void }) {
  const { me, people, refreshBadges } = useSession()
  const [l, setL] = useState<Lead>(lead)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [when, setWhen] = useState('')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const patch = async (p: Partial<Lead>) => {
    const next = { ...l, ...p }
    setL(next)
    const { error } = await supabase.from('leads').update(p).eq('id', l.id)
    if (error) setErr(error.message); else onSaved(next)
  }

  const save = async () => {
    if (!outcome || !me) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('calls').insert({ lead_id: l.id, user_id: me.id, outcome, note: note || null })
    if (error) { setErr(error.message); setBusy(false); return }
    if (outcome === 'toplanti') {
      const { error: e2 } = await supabase.from('meetings').insert({
        lead_id: l.id, created_by: me.id, attendees: [me.id],
        scheduled_at: fromLocalInput(when), contact_name: contact.trim() || null, notes: note || null,
      })
      if (e2) { setErr(e2.message); setBusy(false); return }
    }
    if (outcome === 'sonra_ara') await supabase.from('leads').update({ call_back_at: fromLocalInput(when) }).eq('id', l.id)
    const next: Lead = { ...l, status: outcome as LeadStatus, call_back_at: outcome === 'sonra_ara' ? fromLocalInput(when) : l.call_back_at }
    onSaved(next)
    refreshBadges()
    setBusy(false)
    onClose()
  }

  const st = STATUS[l.status]
  return (
    <Panel onClose={onClose}>
      <h1>{l.business_name}</h1>
      <div className="props">
        <Prop k="Durum"><span className={'tag ' + st.tone}>{st.icon} {st.label}</span></Prop>
        <Prop k="Telefon">
          <input defaultValue={l.phone ?? ''} onBlur={(e) => e.target.value !== (l.phone ?? '') && patch({ phone: e.target.value || null })} />
        </Prop>
        <Prop k="Niş"><input defaultValue={l.niche ?? ''} onBlur={(e) => patch({ niche: e.target.value || null })} /></Prop>
        <Prop k="Semt"><input defaultValue={l.district ?? ''} onBlur={(e) => patch({ district: e.target.value || null })} /></Prop>
        <Prop k="Adres"><span className="muted">{l.address || '—'}</span></Prop>
        <Prop k="Puan">{l.rating ? `★ ${l.rating}` : '—'}{l.review_count ? <span className="faint">&nbsp;· {l.review_count} yorum</span> : null}</Prop>
        <Prop k="Harita">{l.maps_url ? <a href={l.maps_url} target="_blank" rel="noreferrer">Google Maps’te aç ↗</a> : '—'}</Prop>
        {me?.role === 'owner' && (
          <Prop k="Atanan">
            <select value={l.assigned_to ?? ''} onChange={(e) => patch({ assigned_to: e.target.value || null })}>
              <option value="">—</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Prop>
        )}
        {l.call_back_at && <Prop k="Tekrar ara">{new Date(l.call_back_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</Prop>}
        <Prop k="Not">
          <textarea rows={2} defaultValue={l.notes ?? ''} onBlur={(e) => e.target.value !== (l.notes ?? '') && patch({ notes: e.target.value || null })} />
        </Prop>
      </div>

      {l.phone && <a className="btn primary big" style={{ width: '100%' }} href={telHref(l.phone)}>☎︎ Ara · {l.phone}</a>}

      <div className="divider" />
      <div className="muted" style={{ fontSize: 13 }}>Arama sonucu</div>
      <div className="outcomes">
        {OUTCOMES.map((o) => (
          <button key={o.k} className={'outcome' + (outcome === o.k ? ' on' : '')} onClick={() => setOutcome(o.k)}>
            <span className="e">{o.e}</span>{o.l}
          </button>
        ))}
      </div>

      {(outcome === 'toplanti' || outcome === 'sonra_ara') && (
        <div className="field">
          <label>{outcome === 'toplanti' ? 'Toplantı günü ve saati' : 'Ne zaman tekrar aranacak?'}</label>
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      )}
      {outcome === 'toplanti' && (
        <div className="field">
          <label>Yetkilinin adı</label>
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Örn. Büşra Hanım" />
        </div>
      )}
      {outcome === 'toplanti' && (!when || !contact.trim()) && (
        <div className="callout"><span className="ic">⚠️</span>Saat ya da isim girilmezse toplantı “eksik bilgi” olarak işaretlenir ve hatırlatılır.</div>
      )}
      {outcome && (
        <>
          <div className="field">
            <label>Not (isteğe bağlı)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn primary big" style={{ width: '100%' }} disabled={busy} onClick={save}>Kaydet</button>
        </>
      )}
      {err && <div className="err">{err}</div>}
    </Panel>
  )
}
