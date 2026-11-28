import { dirUrl, fmtKm, fmtMin, km, useBase } from '../lib/geo'
import { useEffect, useState } from 'react'
import Panel, { Prop, fromLocalInput, toLocalInput } from './Panel'
import { LOST_REASONS, PACKAGES, STAGES, supabase, telHref, type Deal, type Meeting, type Stage } from '../lib/supabase'
import { useSession } from '../lib/session'

type Result = 'satis' | 'dusunuyor' | 'kayip' | 'gelmedi'

export default function MeetingPanel({ meeting, onClose, onSaved }: { meeting: Meeting; onClose: () => void; onSaved: () => void }) {
  const { people, refreshBadges } = useSession()
  const base = useBase()
  const [m, setM] = useState<Meeting>(meeting)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [pkg, setPkg] = useState('')
  const [amount, setAmount] = useState('')
  const [lost, setLost] = useState('')
  const [follow, setFollow] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('deals').select('*').eq('meeting_id', meeting.id).maybeSingle().then(({ data }) => setDeal(data as Deal | null))
  }, [meeting.id])

  const patch = async (p: Partial<Meeting>) => {
    setM({ ...m, ...p })
    const { error } = await supabase.from('meetings').update(p).eq('id', m.id)
    if (error) setErr(error.message)
    else { onSaved(); refreshBadges() }
  }

  const ended = m.scheduled_at && new Date(m.scheduled_at).getTime() + m.duration_min * 60000 < Date.now()

  const saveResult = async () => {
    if (!result) return
    setBusy(true); setErr('')
    const meetingStatus = result === 'gelmedi' ? 'gelmedi' : 'yapildi'
    await supabase.from('meetings').update({ status: meetingStatus, result_entered: true, notes: note ? [m.notes, note].filter(Boolean).join('\n') : m.notes }).eq('id', m.id)
    if (deal) {
      const stage: Stage = result === 'gelmedi' ? 'dusunuyor' : result
      const p: Partial<Deal> = { stage }
      if (result === 'satis') {
        p.package = pkg || null
        p.amount = amount ? Number(amount) : pkg ? PACKAGES[pkg].price : null
        p.closed_at = new Date().toISOString()
      }
      if (result === 'kayip') p.lost_reason = lost || null
      if (result === 'dusunuyor' || result === 'gelmedi') {
        p.next_followup_at = fromLocalInput(follow) ?? new Date(Date.now() + 3 * 86400000).toISOString()
        p.followup_step = 'ara'
      }
      await supabase.from('deals').update(p).eq('id', deal.id)
      if (result === 'satis') await supabase.from('leads').update({ status: 'musteri' }).eq('id', m.lead_id)
    }
    setBusy(false); onSaved(); refreshBadges(); onClose()
  }

  const missing = !m.scheduled_at || !(m.contact_name ?? '').trim()
  const biz = m.leads

  return (
    <Panel onClose={onClose}>
      <h1>{biz?.business_name ?? 'Toplantı'}</h1>
      {missing && m.status === 'planli' && (
        <div className="callout"><span className="ic">⚠️</span>
          <div><b>Eksik bilgi.</b> {!m.scheduled_at && 'Saat girilmemiş. '}{!(m.contact_name ?? '').trim() && 'Yetkilinin adı girilmemiş.'}</div>
        </div>
      )}
      <div className="props">
        <Prop k="Zaman">
          <input type="datetime-local" defaultValue={toLocalInput(m.scheduled_at)} onBlur={(e) => patch({ scheduled_at: fromLocalInput(e.target.value) })} />
        </Prop>
        <Prop k="Süre">
          <select value={m.duration_min} onChange={(e) => patch({ duration_min: Number(e.target.value) })}>
            {[30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} dk</option>)}
          </select>
        </Prop>
        <Prop k="Yetkili">
          <input defaultValue={m.contact_name ?? ''} placeholder="İsim gir" onBlur={(e) => patch({ contact_name: e.target.value.trim() || null })} />
        </Prop>
        <Prop k="Katılan">{people.filter((p) => m.attendees?.includes(p.id)).map((p) => p.full_name).join(', ') || '—'}</Prop>
        <Prop k="Telefon">{biz?.phone ? <a href={telHref(biz.phone)}>{biz.phone}</a> : '—'}</Prop>
        <Prop k="Adres"><span className="muted">{[biz?.district, biz?.address].filter(Boolean).join(' · ') || '—'}</span></Prop>
        <Prop k="Mesafe">{(() => { const d = km(base, biz); return d == null ? <span className="muted">—</span> : <span>{fmtKm(d)} <span className="muted">· arabayla {fmtMin(d)} (ofisten)</span></span> })()}</Prop>
        {deal && <Prop k="Satış aşaması"><span className={'tag ' + STAGES.find((s) => s.key === deal.stage)!.tone}>{STAGES.find((s) => s.key === deal.stage)!.label}</span></Prop>}
        <Prop k="Not"><textarea rows={2} defaultValue={m.notes ?? ''} onBlur={(e) => patch({ notes: e.target.value || null })} /></Prop>
      </div>

      {dirUrl(biz) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <a className="btn primary" href={dirUrl(biz)!} target="_blank" rel="noreferrer" style={{ flex: 1, justifyContent: 'center' }}>🧭 Yol tarifi</a>
          {biz?.maps_url && <a className="btn" href={biz.maps_url} target="_blank" rel="noreferrer">📍 Haritada gör</a>}
        </div>
      )}
      {m.status === 'planli' && (
        <>
          <div className="divider" />
          <div className="muted" style={{ fontSize: 13 }}>{ended ? 'Toplantı nasıl geçti?' : 'Toplantı sonucu (toplantıdan sonra)'}</div>
          <div className="outcomes">
            {([['satis', '✅', 'Satış'], ['dusunuyor', '🤔', 'Düşünüyor'], ['kayip', '❌', 'Kayıp'], ['gelmedi', '🚫', 'Olmadı']] as const).map(([k, e, l]) => (
              <button key={k} className={'outcome' + (result === k ? ' on' : '')} onClick={() => setResult(k)}><span className="e">{e}</span>{l}</button>
            ))}
          </div>
          {result === 'satis' && (
            <>
              <div className="field"><label>Paket</label>
                <div className="chips">
                  {Object.entries(PACKAGES).map(([k, p]) => (
                    <button key={k} className={'chip' + (pkg === k ? ' on' : '')} onClick={() => { setPkg(k); if (p.price) setAmount(String(p.price)) }}>
                      {p.label}{p.price ? ` · ${p.price / 1000}k` : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field"><label>Tutar (TL)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></div>
            </>
          )}
          {result === 'kayip' && (
            <div className="field"><label>Neden?</label>
              <div className="chips">
                {Object.entries(LOST_REASONS).map(([k, v]) => <button key={k} className={'chip' + (lost === k ? ' on' : '')} onClick={() => setLost(k)}>{v}</button>)}
              </div>
            </div>
          )}
          {(result === 'dusunuyor' || result === 'gelmedi') && (
            <div className="field"><label>Ne zaman tekrar aranacak? (boş bırakırsan 3 gün sonra)</label>
              <input className="input" type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} />
            </div>
          )}
          {result && (
            <>
              <div className="field"><label>Not (isteğe bağlı)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <button className="btn primary big" style={{ width: '100%' }} disabled={busy || (result === 'satis' && !pkg)} onClick={saveResult}>Sonucu kaydet</button>
            </>
          )}
          <div style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => { if (confirm('Toplantı iptal edilsin mi?')) patch({ status: 'iptal', result_entered: true }).then(onClose) }}>Toplantıyı iptal et</button>
          </div>
        </>
      )}
      {err && <div className="err">{err}</div>}
    </Panel>
  )
}
