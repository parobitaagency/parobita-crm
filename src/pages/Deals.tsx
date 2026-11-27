import { useCallback, useEffect, useState } from 'react'
import { LOST_REASONS, PACKAGES, STAGES, supabase, tl, type Deal, type Stage } from '../lib/supabase'
import Panel, { Prop, fromLocalInput, toLocalInput } from '../components/Panel'
import { useSession } from '../lib/session'
import { Link } from 'react-router-dom'

const TARGET = 1_000_000

function DealPanel({ deal, onClose, onSaved }: { deal: Deal; onClose: () => void; onSaved: () => void }) {
  const { me } = useSession()
  const [d, setD] = useState(deal)
  const [pay, setPay] = useState('')
  const paid = (d.payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const owner = me?.role === 'owner'

  const patch = async (p: Partial<Deal>) => {
    setD({ ...d, ...p })
    await supabase.from('deals').update(p).eq('id', d.id)
    onSaved()
  }
  const addPay = async () => {
    const n = Number(pay); if (!n) return
    await supabase.from('payments').insert({ deal_id: d.id, amount: n })
    setD({ ...d, payments: [...(d.payments ?? []), { amount: n }] }); setPay(''); onSaved()
  }

  return (
    <Panel onClose={onClose}>
      <h1>{d.leads?.business_name}</h1>
      <div className="props">
        <Prop k="Aşama">
          <select value={d.stage} disabled={!owner} onChange={(e) => patch({ stage: e.target.value as Stage, closed_at: ['satis', 'kayip'].includes(e.target.value) ? new Date().toISOString() : null })}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Prop>
        <Prop k="Paket">
          <select value={d.package ?? ''} disabled={!owner} onChange={(e) => patch({ package: e.target.value || null, amount: d.amount ?? (PACKAGES[e.target.value]?.price || null) })}>
            <option value="">—</option>
            {Object.entries(PACKAGES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </Prop>
        <Prop k="Tutar"><input inputMode="numeric" disabled={!owner} defaultValue={d.amount ?? ''} onBlur={(e) => patch({ amount: e.target.value ? Number(e.target.value) : null })} /></Prop>
        {d.amount ? (
          <>
            <Prop k="Ödenen">{tl(paid)} <span className="faint">&nbsp;/ kalan {tl(Number(d.amount) - paid)}</span></Prop>
            <Prop k="Pay (50/50)">{tl(Number(d.amount) / 2)} <span className="faint">&nbsp;kişi başı</span></Prop>
          </>
        ) : null}
        {d.stage === 'kayip' && (
          <Prop k="Kayıp sebebi">
            <select value={d.lost_reason ?? ''} onChange={(e) => patch({ lost_reason: e.target.value || null })}>
              <option value="">—</option>
              {Object.entries(LOST_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Prop>
        )}
        {(d.stage === 'dusunuyor' || d.stage === 'teklif' || d.stage === 'demo') && (
          <>
            <Prop k="Sonraki takip"><input type="datetime-local" defaultValue={toLocalInput(d.next_followup_at)} onBlur={(e) => patch({ next_followup_at: fromLocalInput(e.target.value) })} /></Prop>
            <Prop k="Takip adımı">
              <select value={d.followup_step} onChange={(e) => patch({ followup_step: e.target.value as Deal['followup_step'] })}>
                <option value="ara">Önce ara</option>
                <option value="cat_kapi">Çat kapı git</option>
              </select>
            </Prop>
          </>
        )}
        <Prop k="Not"><textarea rows={2} defaultValue={d.notes ?? ''} onBlur={(e) => patch({ notes: e.target.value || null })} /></Prop>
      </div>
      {owner && d.amount ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" inputMode="numeric" placeholder="Ödeme tutarı" value={pay} onChange={(e) => setPay(e.target.value.replace(/\D/g, ''))} />
          <button className="btn" onClick={addPay}>Ödeme ekle</button>
        </div>
      ) : null}
    </Panel>
  )
}

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [open, setOpen] = useState<Deal | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('deals').select('*, leads(business_name, phone, district), payments(amount)').order('updated_at', { ascending: false })
    setDeals((data ?? []) as Deal[])
  }, [])
  useEffect(() => { load() }, [load])

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const won = deals.filter((d) => d.stage === 'satis')
  const wonMonth = won.filter((d) => d.closed_at && new Date(d.closed_at) >= monthStart)
  const revenue = won.reduce((s, d) => s + Number(d.amount ?? 0), 0)
  const monthRev = wonMonth.reduce((s, d) => s + Number(d.amount ?? 0), 0)
  const closed = deals.filter((d) => d.stage === 'satis' || d.stage === 'kayip').length
  const rate = closed ? Math.round((won.length / closed) * 100) : 0
  const due = (d: Deal) => d.next_followup_at && new Date(d.next_followup_at) <= new Date()

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-icon">◆</div>
        <h1 className="title">Satışlar</h1>
      </div>

      <Link to="/analiz" className="stats stats-link">
        <div className="stat"><div className="k">Bu ay ciro ›</div><div className="v">{tl(monthRev)}</div></div>
        <div className="stat"><div className="k">Bu ay satış</div><div className="v">{wonMonth.length}</div></div>
        <div className="stat"><div className="k">Kapanış oranı</div><div className="v">%{rate}</div></div>
        <div className="stat"><div className="k">1M hedefi</div><div className="v">%{Math.round((revenue / TARGET) * 100)}</div>
          <div className="progress"><div style={{ width: `${Math.min(100, (revenue / TARGET) * 100)}%` }} /></div></div>
      </Link>

      <h2 className="section">Pano</h2>
      <div className="board">
        {STAGES.map((s) => {
          const items = deals.filter((d) => d.stage === s.key)
          return (
            <div className="col" key={s.key}>
              <div className="col-head"><span className={'tag ' + s.tone}>{s.label}</span><span className="faint">{items.length}</span></div>
              {items.map((d) => (
                <div className="card" key={d.id} onClick={() => setOpen(d)}>
                  <div className="t">{d.leads?.business_name}</div>
                  <div className="meta">
                    {d.package && <span>{PACKAGES[d.package]?.label}</span>}
                    {d.amount ? <span>{tl(d.amount)}</span> : null}
                    {d.stage === 'kayip' && d.lost_reason && <span>{LOST_REASONS[d.lost_reason]}</span>}
                    {due(d) && <span className="warn-dot">Takip zamanı · {d.followup_step === 'cat_kapi' ? 'çat kapı' : 'ara'}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {open && <DealPanel deal={open} onClose={() => setOpen(null)} onSaved={load} />}
    </div>
  )
}
