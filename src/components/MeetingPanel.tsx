import { dirUrl, fmtKm, fmtMin, km, useBase } from '../lib/geo'
import { useEffect, useState } from 'react'
import Panel, { Prop, fromLocalInput, toLocalInput } from './Panel'
import { LOST_REASONS, PACKAGES, STAGES, supabase, telHref, type Deal, type Meeting, type Stage } from '../lib/supabase'
import { useSession } from '../lib/session'

type Result = 'satis' | 'teklif' | 'dusunuyor' | 'danisacak' | 'wp' | 'tekrar' | 'uzun_vade' | 'gelmedi' | 'kayip'
const RESULTS: [Result, string, string][] = [
  ['satis', '✅', 'Satış'],
  ['teklif', '💰', 'Teklif verdik'],
  ['dusunuyor', '🤔', 'Düşünecek'],
  ['danisacak', '👥', 'Ortağına/eşine danışacak'],
  ['wp', '📲', 'WhatsApp’tan bilgi/fiyat istedi'],
  ['tekrar', '🔁', 'Tekrar görüşelim dedi'],
  ['uzun_vade', '⏳', 'İleride (uzun vade)'],
  ['gelmedi', '🚫', 'Olmadı / yetkili yoktu'],
  ['kayip', '❌', 'Almayacak'],
]
const FOLLOW_QUICK: Partial<Record<Result, [string, number][]>> = {
  teklif: [['Yarın', 1], ['3 gün', 3], ['1 hafta', 7]],
  dusunuyor: [['2 gün', 2], ['3 gün', 3], ['1 hafta', 7]],
  danisacak: [['Yarın', 1], ['2 gün', 2], ['1 hafta', 7]],
  wp: [['2 gün', 2], ['1 hafta', 7], ['2 hafta', 14]],
  uzun_vade: [['1 ay', 30], ['3 ay', 91], ['6 ay', 182]],
  gelmedi: [['Yarın', 1], ['2 gün', 2], ['1 hafta', 7]],
}
const FOLLOW_DEF: Partial<Record<Result, number>> = { teklif: 3, dusunuyor: 3, danisacak: 2, wp: 2, uzun_vade: 91, gelmedi: 1 }
const inDays = (d: number) => { const x = new Date(Date.now() + d * 86400000); x.setHours(10, 0, 0, 0); return x.toISOString() }

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
  const [paid, setPaid] = useState('')
  const [next, setNext] = useState('')
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
    if (result === 'tekrar' && !next) { setErr('Yeni görüşmenin gününü ve saatini gir.'); return }
    setBusy(true); setErr('')
    const label = RESULTS.find((r) => r[0] === result)![2]
    const fullNote = [m.notes, `Sonuç: ${label}${note ? ' — ' + note : ''}`].filter(Boolean).join('\n')
    await supabase.from('meetings').update({ status: result === 'gelmedi' ? 'gelmedi' : 'yapildi', result_entered: true, notes: fullNote }).eq('id', m.id)
    const followAt = fromLocalInput(follow) ?? (FOLLOW_DEF[result] ? inDays(FOLLOW_DEF[result]!) : null)
    if (deal) {
      const stageOf: Record<Result, Stage> = { satis: 'satis', teklif: 'teklif', dusunuyor: 'dusunuyor', danisacak: 'dusunuyor', wp: 'dusunuyor', tekrar: 'demo', uzun_vade: 'dusunuyor', gelmedi: 'toplanti', kayip: 'kayip' }
      const p: Partial<Deal> = { stage: stageOf[result], notes: [deal.notes, `${new Date().toLocaleDateString('tr-TR')}: ${label}${note ? ' — ' + note : ''}`].filter(Boolean).join('\n') }
      if (result === 'satis' || result === 'teklif') {
        p.package = pkg || deal.package || null
        p.amount = amount ? Number(amount) : pkg && PACKAGES[pkg].price ? PACKAGES[pkg].price : deal.amount
      }
      if (result === 'satis') { p.closed_at = new Date().toISOString(); p.next_followup_at = null }
      if (result === 'kayip') { p.lost_reason = lost || null; p.closed_at = new Date().toISOString(); p.next_followup_at = null }
      if (followAt && result !== 'satis' && result !== 'kayip') { p.next_followup_at = followAt; p.followup_step = 'ara' }
      if (result === 'tekrar') p.next_followup_at = fromLocalInput(next)
      await supabase.from('deals').update(p).eq('id', deal.id)
      if (result === 'satis' && paid && Number(paid) > 0) await supabase.from('payments').insert({ deal_id: deal.id, amount: Number(paid), paid_at: new Date().toISOString().slice(0, 10), note: 'Toplantıda alındı' })
    }
    if (result === 'satis') await supabase.from('leads').update({ status: 'musteri' }).eq('id', m.lead_id)
    if (result === 'wp') await supabase.from('leads').update({ status: 'wp', wa_sent_at: null, call_back_at: followAt }).eq('id', m.lead_id)
    if (result === 'uzun_vade') await supabase.from('leads').update({ status: 'uzun_vade', call_back_at: followAt }).eq('id', m.lead_id)
    if (result === 'tekrar') {
      await supabase.from('meetings').insert({ lead_id: m.lead_id, created_by: m.created_by, attendees: m.attendees, scheduled_at: fromLocalInput(next), contact_name: m.contact_name, notes: 'İkinci görüşme' })
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
          <div className="outcomes outcomes-3">
            {RESULTS.map(([k, e, l]) => (
              <button key={k} className={'outcome' + (result === k ? ' on' : '')} onClick={() => { setResult(k); setFollow(''); setErr('') }}><span className="e">{e}</span>{l}</button>
            ))}
          </div>
          {(result === 'satis' || result === 'teklif') && (
            <>
              <div className="field"><label>{result === 'satis' ? 'Hangi paketi aldı?' : 'Hangi paketi teklif ettik?'}</label>
                <div className="chips">
                  {Object.entries(PACKAGES).map(([k, p]) => (
                    <button key={k} className={'chip' + (pkg === k ? ' on' : '')} onClick={() => { setPkg(k); if (p.price) setAmount(String(p.price)) }}>
                      {p.label}{p.price ? ` · ${p.price / 1000}k` : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field"><label>Tutar (TL)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></div>
              {result === 'satis' && (
                <div className="field"><label>Şimdi alınan ödeme / kapora (TL, yoksa boş)</label>
                  <div className="chips" style={{ marginBottom: 6 }}>
                    {amount && <button className={'chip' + (paid === amount ? ' on' : '')} onClick={() => setPaid(amount)}>Tamamı</button>}
                    {amount && <button className={'chip' + (paid === String(Math.round(Number(amount) / 2)) ? ' on' : '')} onClick={() => setPaid(String(Math.round(Number(amount) / 2)))}>Yarısı</button>}
                  </div>
                  <input className="input" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value.replace(/\D/g, ''))} />
                </div>
              )}
            </>
          )}
          {result === 'kayip' && (
            <div className="field"><label>Neden almadı?</label>
              <div className="chips">
                {Object.entries(LOST_REASONS).map(([k, v]) => <button key={k} className={'chip' + (lost === k ? ' on' : '')} onClick={() => setLost(k)}>{v}</button>)}
              </div>
            </div>
          )}
          {result === 'tekrar' && (
            <div className="field"><label>Yeni görüşme günü ve saati</label>
              <input className="input" type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
          )}
          {result && FOLLOW_QUICK[result] && (
            <div className="field"><label>{result === 'wp' ? 'Mesajdan sonra ne zaman arayalım?' : result === 'gelmedi' ? 'Ne zaman tekrar arayıp yeni gün alalım?' : 'Ne zaman takip edelim?'}</label>
              <div className="chips" style={{ marginBottom: 6 }}>
                {FOLLOW_QUICK[result]!.map(([lbl, d]) => { const v = toLocalInput(inDays(d)); return <button key={lbl} className={'chip' + (follow === v ? ' on' : '')} onClick={() => setFollow(v)}>{lbl}</button> })}
              </div>
              <input className="input" type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} />
            </div>
          )}
          {result === 'wp' && biz?.phone && (
            <div className="callout neutral"><span className="ic">📲</span>Kaydedince Bugün sayfasındaki “WhatsApp bekleyenler” listesine düşer, mesaj hazır gelir.</div>
          )}
          {result && (
            <>
              <div className="field"><label>Not (isteğe bağlı)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <button className="btn primary big" style={{ width: '100%' }} disabled={busy || (result === 'satis' && !pkg)} onClick={saveResult}>Sonucu kaydet</button>
              {err && <div className="err">{err}</div>}
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
