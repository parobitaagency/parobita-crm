import { useState } from 'react'
import Panel, { Prop, fromLocalInput, toLocalInput } from './Panel'
import { STATUS, supabase, telHref, waLink, type Lead, type LeadStatus } from '../lib/supabase'
import { useSession } from '../lib/session'

export type Outcome = 'acmadi' | 'sonra_ara' | 'red' | 'toplanti' | 'wp' | 'uzun_vade' | 'gecersiz'
const OUTCOMES: { k: Outcome; e: string; l: string }[] = [
  { k: 'toplanti', e: '✅', l: 'Toplantı' },
  { k: 'red', e: '❌', l: 'Red' },
  { k: 'acmadi', e: '⏸️', l: 'Açmadı' },
  { k: 'sonra_ara', e: '⚠️', l: 'Sonra ara' },
  { k: 'wp', e: '📲', l: 'WhatsApp’tan bilgi' },
  { k: 'uzun_vade', e: '⏳', l: 'Uzun vade' },
  { k: 'gecersiz', e: '🚫', l: 'Yanlış no / kapalı' },
]
const QUICK: Partial<Record<Outcome, [string, number][]>> = {
  sonra_ara: [['1 saat', 1 / 24], ['Yarın', 1], ['3 gün', 3]],
  wp: [['2 gün', 2], ['1 hafta', 7], ['2 hafta', 14]],
  uzun_vade: [['1 ay', 30], ['3 ay', 91], ['6 ay', 182]],
}
const DEF_DAYS: Partial<Record<Outcome, number>> = { sonra_ara: 1, wp: 2, uzun_vade: 91 }
const inDays = (d: number) => { const x = new Date(Date.now() + d * 86400000); if (d >= 1) x.setHours(10, 0, 0, 0); return x.toISOString() }

export default function LeadPanel({ lead, onClose, onSaved, initialOutcome }: { lead: Lead; onClose: () => void; onSaved: (l: Lead) => void; initialOutcome?: Outcome }) {
  const { me, people, refreshBadges } = useSession()
  const [l, setL] = useState<Lead>(lead)
  const [outcome, setOutcome] = useState<Outcome | null>(initialOutcome ?? null)
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
    let cb = l.call_back_at
    if (outcome in DEF_DAYS) {
      cb = fromLocalInput(when) ?? inDays(DEF_DAYS[outcome]!)
      await supabase.from('leads').update({ call_back_at: cb }).eq('id', l.id)
    }
    const next: Lead = { ...l, status: outcome as LeadStatus, call_back_at: cb }
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

      {outcome && (outcome === 'toplanti' || outcome in DEF_DAYS) && (
        <div className="field">
          <label>{outcome === 'toplanti' ? 'Toplantı günü ve saati' : outcome === 'wp' ? 'Mesajdan sonra ne zaman tekrar arayalım?' : outcome === 'uzun_vade' ? 'Ne zaman tekrar deneyelim?' : 'Ne zaman tekrar aranacak?'}</label>
          {QUICK[outcome] && (
            <div className="chips" style={{ marginBottom: 6 }}>
              {QUICK[outcome]!.map(([lbl, d]) => {
                const v = toLocalInput(inDays(d))
                return <button key={lbl} type="button" className={'chip' + (when === v ? ' on' : '')} onClick={() => setWhen(v)}>{lbl}</button>
              })}
            </div>
          )}
          <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      )}
      {outcome === 'wp' && l.phone && me && (
        <a className="btn big" style={{ width: '100%', marginBottom: 8 }} href={waLink(l.phone, me.full_name.split(' ')[0])} target="_blank" rel="noreferrer"
          onClick={() => supabase.from('leads').update({ wa_sent_at: new Date().toISOString() }).eq('id', l.id).then(() => {})}>💬 Şimdi WhatsApp’tan gönder</a>
      )}
      {outcome === 'gecersiz' && <div className="callout neutral"><span className="ic">🚫</span>Bu numara arama listesinden çıkar.</div>}
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
