import { useEffect, useMemo, useRef, useState } from 'react'
import { LOST_REASONS, PACKAGES, STAGES, supabase, tl } from '../lib/supabase'
import { useSession } from '../lib/session'

const TARGET = 1_000_000
const DAY = 86400000
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
// Kâr olasılığı: açık anlaşmaların ağırlıklı değeri için
const STAGE_P: Record<string, number> = { toplanti: 0.15, demo: 0.25, teklif: 0.4, dusunuyor: 0.3 }

type ADeal = {
  id: string; stage: string; package: string | null; amount: number | null; lost_reason: string | null
  closed_at: string | null; created_at: string; owner_id: string | null; caller_id: string | null
  leads: { business_name: string; niche: string | null; district: string | null; source: string | null } | null
  payments: { amount: number; paid_at: string | null }[]
}
type ACall = { user_id: string; outcome: string; called_at: string; leads: { source: string | null } | null }
type AMeet = { created_by: string | null; scheduled_at: string | null; created_at: string; status: string; leads: { source: string | null } | null }

type Period = 'bu_ay' | 'gecen_ay' | '30' | '90' | 'yil' | 'tumu'
const PERIODS: { k: Period; l: string }[] = [
  { k: 'bu_ay', l: 'Bu ay' }, { k: 'gecen_ay', l: 'Geçen ay' }, { k: '30', l: '30 gün' },
  { k: '90', l: '90 gün' }, { k: 'yil', l: 'Bu yıl' }, { k: 'tumu', l: 'Tümü' },
]

function range(p: Period): [Date, Date] {
  const now = new Date()
  const som = new Date(now.getFullYear(), now.getMonth(), 1)
  switch (p) {
    case 'bu_ay': return [som, now]
    case 'gecen_ay': return [new Date(now.getFullYear(), now.getMonth() - 1, 1), som]
    case '30': return [new Date(now.getTime() - 30 * DAY), now]
    case '90': return [new Date(now.getTime() - 90 * DAY), now]
    case 'yil': return [new Date(now.getFullYear(), 0, 1), now]
    default: return [new Date(2026, 6, 1), now]
  }
}
const within = (iso: string | null | undefined, [a, b]: [Date, Date]) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime() + 1 }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const short = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'M' : n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'B' : String(Math.round(n))

/* ---------- Grafik parçaları ---------- */

function Tip({ x, y, children }: { x: string; y: number; children: React.ReactNode }) {
  return <div className="viz-tip" style={{ left: x, top: y }}>{children}</div>
}

function TimeBars({ data, fmt, empty }: { data: { label: string; sub: string; v: number; extra?: string }[]; fmt: (n: number) => string; empty: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const W = 640, H = 200, pad = { l: 40, r: 8, t: 10, b: 24 }
  const max = Math.max(1, ...data.map((d) => d.v))
  const nice = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / nice) * nice
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top)
  const every = Math.ceil(data.length / 8)
  if (!data.some((d) => d.v)) return <div className="viz-empty">{empty}</div>
  return (
    <div className="viz" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 200 }}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(top * f)} y2={y(top * f)} className="viz-grid" />
            <text x={pad.l - 6} y={y(top * f) + 4} className="viz-axis" textAnchor="end">{short(top * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, y(0) - y(d.v)); const x = pad.l + i * bw + Math.max(1, bw * 0.15); const w = Math.max(2, bw * 0.7)
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {d.v > 0 && <path d={`M${x},${y(0)} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${Math.max(0, h - 4)} z`} className={'viz-bar' + (hover === i ? ' on' : '')} />}
              {i % every === 0 && <text x={pad.l + i * bw + bw / 2} y={H - 6} className="viz-axis" textAnchor="middle">{d.label}</text>}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Tip x={`${((pad.l + hover * bw + bw / 2) / W) * 100}%`} y={8}>
          <b>{fmt(data[hover].v)}</b><span>{data[hover].sub}</span>{data[hover].extra && <span>{data[hover].extra}</span>}
        </Tip>
      )}
    </div>
  )
}

function HBars({ rows, fmt, empty }: { rows: { k: string; v: number; sub?: string }[]; fmt: (n: number) => string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  if (!rows.length) return <div className="viz-empty">{empty}</div>
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.k} title={`${r.k}: ${fmt(r.v)}`}>
          <div className="hbar-k">{r.k}</div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(r.v / max) * 100}%` }} /></div>
          <div className="hbar-v">{fmt(r.v)}{r.sub && <span> · {r.sub}</span>}</div>
        </div>
      ))}
    </div>
  )
}

function Heat({ cells, metric }: { cells: { calls: number; ans: number; meet: number }[][]; metric: 'ans' | 'meet' | 'calls' }) {
  const hours = Array.from({ length: 12 }, (_, i) => 9 + i)
  const val = (c: { calls: number; ans: number; meet: number }) => metric === 'calls' ? c.calls : c.calls < 3 ? -1 : metric === 'ans' ? c.ans / c.calls : c.meet / c.calls
  const max = Math.max(0.0001, ...cells.flat().map(val))
  const ramp = ['#cce3fd', '#9dc8f7', '#6aabf1', '#338ced', '#2370cd', '#1757ac', '#0e3d7e']
  return (
    <div className="heat">
      <div className="heat-row heat-head"><span />{hours.map((h) => <span key={h}>{h}</span>)}</div>
      {WEEKDAYS.slice(0, 6).map((d, wi) => (
        <div className="heat-row" key={d}>
          <span className="heat-day">{d}</span>
          {hours.map((h) => {
            const c = cells[wi][h - 9]; const v = val(c)
            const bg = v < 0 || c.calls === 0 ? undefined : ramp[Math.min(ramp.length - 1, Math.floor((v / max) * (ramp.length - 0.01)))]
            const label = c.calls === 0 ? 'arama yok' : `${c.calls} arama · %${pct(c.ans, c.calls)} açtı · ${c.meet} toplantı`
            return <span key={h} className={'heat-cell' + (bg ? '' : ' none')} style={bg ? { background: bg } : undefined} title={`${d} ${h}:00 — ${label}`} />
          })}
        </div>
      ))}
      <div className="heat-legend"><span>az</span>{ramp.map((c) => <i key={c} style={{ background: c }} />)}<span>çok</span><span className="faint">· en az 3 arama olan saatler</span></div>
    </div>
  )
}

function Kpi({ k, v, prev, fmt, hint }: { k: string; v: number; prev?: number; fmt: (n: number) => string; hint?: string }) {
  const d = prev === undefined || prev === 0 ? null : Math.round(((v - prev) / prev) * 100)
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{fmt(v)}</div>
      {d !== null ? <div className={'delta ' + (d >= 0 ? 'up' : 'down')}>{d >= 0 ? '▲' : '▼'} %{Math.abs(d)} <span className="faint">önceki döneme göre</span></div>
        : hint ? <div className="delta faint">{hint}</div> : null}
    </div>
  )
}

/* ---------- Sayfa ---------- */

export default function Analytics() {
  const { people } = useSession()
  const [deals, setDeals] = useState<ADeal[]>([])
  const [calls, setCalls] = useState<ACall[]>([])
  const [meets, setMeets] = useState<AMeet[]>([])
  const [period, setPeriod] = useState<Period>(() => (localStorage.getItem('pb-an-period') as Period) || 'bu_ay')
  const [who, setWho] = useState<string>('')
  const [dim, setDim] = useState<'nis' | 'semt' | 'paket' | 'kisi'>('nis')
  const [heatM, setHeatM] = useState<'ans' | 'meet' | 'calls'>('ans')

  useEffect(() => { localStorage.setItem('pb-an-period', period) }, [period])
  useEffect(() => {
    supabase.from('deals').select('id, stage, package, amount, lost_reason, closed_at, created_at, owner_id, caller_id, leads(business_name, niche, district, source), payments(amount, paid_at)')
      .then(({ data }) => setDeals(((data ?? []) as unknown as ADeal[]).filter((d) => d.leads?.source !== 'test')))
    supabase.from('calls').select('user_id, outcome, called_at, leads(source)').gte('called_at', '2026-07-01').order('called_at').limit(20000)
      .then(({ data }) => setCalls(((data ?? []) as unknown as ACall[]).filter((c) => c.leads?.source !== 'test')))
    supabase.from('meetings').select('created_by, scheduled_at, created_at, status, leads(source)')
      .then(({ data }) => setMeets(((data ?? []) as unknown as AMeet[]).filter((m) => m.leads?.source !== 'test')))
  }, [])

  const r = range(period)
  const span = r[1].getTime() - r[0].getTime()
  const prevR: [Date, Date] = period === 'tumu' ? [new Date(0), new Date(0)] : period === 'bu_ay' || period === 'gecen_ay'
    ? [new Date(r[0].getFullYear(), r[0].getMonth() - 1, 1), new Date(r[0].getFullYear(), r[0].getMonth() - 1, Math.min(new Date(r[1].getTime() - 1).getDate(), 31), 23, 59)]
    : [new Date(r[0].getTime() - span), r[0]]
  const mine = (uid: string | null | undefined) => !who || uid === who
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name.split(' ')[0] ?? '—'

  const m = useMemo(() => {
    const ds = deals.filter((d) => mine(d.owner_id ?? d.caller_id))
    const cs = calls.filter((c) => mine(c.user_id))
    const ms = meets.filter((x) => mine(x.created_by))
    const calc = (R: [Date, Date]) => {
      const won = ds.filter((d) => d.stage === 'satis' && within(d.closed_at, R))
      const lost = ds.filter((d) => d.stage === 'kayip' && within(d.closed_at, R))
      const rev = won.reduce((s, d) => s + Number(d.amount ?? 0), 0)
      const paid = ds.flatMap((d) => d.payments).filter((p) => within(p.paid_at, R)).reduce((s, p) => s + Number(p.amount), 0)
      const c = cs.filter((x) => within(x.called_at, R))
      const ans = c.filter((x) => x.outcome !== 'acmadi' && x.outcome !== 'gecersiz').length
      const meet = c.filter((x) => x.outcome === 'toplanti').length
      return { won, lost, rev, paid, calls: c, ans, meet, avg: won.length ? rev / won.length : 0 }
    }
    return { ds, cs, ms, cur: calc(r), prev: calc(prevR) }
  }, [deals, calls, meets, period, who]) // eslint-disable-line react-hooks/exhaustive-deps

  const { cur, prev, ds } = m
  const hasPrev = period !== 'tumu'

  // Zaman serisi: ≤ 45 gün günlük, ≤ 200 gün haftalık, üstü aylık
  const series = useMemo(() => {
    const days = Math.ceil(span / DAY)
    const unit = days <= 45 ? 'g' : days <= 200 ? 'h' : 'a'
    const buckets: { start: Date; label: string; sub: string; rev: number; n: number; calls: number; meet: number }[] = []
    let t = new Date(r[0]); t.setHours(0, 0, 0, 0)
    if (unit === 'h') { const wd = (t.getDay() + 6) % 7; t = new Date(t.getTime() - wd * DAY) }
    if (unit === 'a') t = new Date(t.getFullYear(), t.getMonth(), 1)
    while (t <= r[1]) {
      const next = unit === 'g' ? new Date(t.getTime() + DAY) : unit === 'h' ? new Date(t.getTime() + 7 * DAY) : new Date(t.getFullYear(), t.getMonth() + 1, 1)
      const label = unit === 'a' ? MONTHS[t.getMonth()] : `${t.getDate()} ${MONTHS[t.getMonth()]}`
      const sub = unit === 'g' ? `${WEEKDAYS[(t.getDay() + 6) % 7]}, ${label}` : unit === 'h' ? `${label} haftası` : `${MONTHS[t.getMonth()]} ${t.getFullYear()}`
      buckets.push({ start: t, label: unit === 'g' ? String(t.getDate()) : label, sub, rev: 0, n: 0, calls: 0, meet: 0 })
      t = next
    }
    const idx = (iso: string) => { const x = new Date(iso).getTime(); for (let i = buckets.length - 1; i >= 0; i--) if (x >= buckets[i].start.getTime()) return i; return -1 }
    cur.won.forEach((d) => { const i = idx(d.closed_at!); if (i >= 0) { buckets[i].rev += Number(d.amount ?? 0); buckets[i].n++ } })
    cur.calls.forEach((c) => { const i = idx(c.called_at); if (i >= 0) { buckets[i].calls++; if (c.outcome === 'toplanti') buckets[i].meet++ } })
    return buckets
  }, [cur, period]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kırılım
  const breakdown = useMemo(() => {
    const key = (d: ADeal) => dim === 'nis' ? d.leads?.niche || 'Belirsiz' : dim === 'semt' ? d.leads?.district || 'Belirsiz'
      : dim === 'paket' ? (d.package ? PACKAGES[d.package]?.label ?? d.package : 'Paket yok') : nameOf(d.owner_id ?? d.caller_id)
    const map = new Map<string, { v: number; n: number }>()
    cur.won.forEach((d) => { const k = key(d); const e = map.get(k) ?? { v: 0, n: 0 }; e.v += Number(d.amount ?? 0); e.n++; map.set(k, e) })
    return [...map].map(([k, e]) => ({ k, v: e.v, sub: `${e.n} satış` })).sort((a, b) => b.v - a.v).slice(0, 8)
  }, [cur, dim]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toplantıdan satışa dönüşüm (niş bazında, tüm zamanlar — veri az olduğu için)
  const nicheConv = useMemo(() => {
    const map = new Map<string, { won: number; closed: number }>()
    ds.filter((d) => d.stage === 'satis' || d.stage === 'kayip').forEach((d) => {
      const k = d.leads?.niche || 'Belirsiz'; const e = map.get(k) ?? { won: 0, closed: 0 }
      e.closed++; if (d.stage === 'satis') e.won++; map.set(k, e)
    })
    return [...map].filter(([, e]) => e.closed >= 2).map(([k, e]) => ({ k, v: pct(e.won, e.closed), sub: `${e.won}/${e.closed}` })).sort((a, b) => b.v - a.v).slice(0, 8)
  }, [ds])

  const lostRows = useMemo(() => {
    const map = new Map<string, number>()
    ds.filter((d) => d.stage === 'kayip' && within(d.closed_at, r)).forEach((d) => { const k = d.lost_reason ? LOST_REASONS[d.lost_reason] : 'Sebep girilmedi'; map.set(k, (map.get(k) ?? 0) + 1) })
    return [...map].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
  }, [ds, period]) // eslint-disable-line react-hooks/exhaustive-deps

  const heat = useMemo(() => {
    const g = Array.from({ length: 6 }, () => Array.from({ length: 12 }, () => ({ calls: 0, ans: 0, meet: 0 })))
    cur.calls.forEach((c) => {
      const d = new Date(c.called_at); const wd = (d.getDay() + 6) % 7; const h = d.getHours()
      if (wd > 5 || h < 9 || h > 20) return
      const cell = g[wd][h - 9]; cell.calls++; if (c.outcome !== 'acmadi' && c.outcome !== 'gecersiz') cell.ans++; if (c.outcome === 'toplanti') cell.meet++
    })
    return g
  }, [cur])

  // Açık hat (pipeline)
  const open = ds.filter((d) => STAGE_P[d.stage] !== undefined)
  const openVal = (d: ADeal) => Number(d.amount ?? (d.package ? PACKAGES[d.package]?.price : 0) ?? 0) || 9000
  const pipeline = open.reduce((s, d) => s + openVal(d), 0)
  const weighted = open.reduce((s, d) => s + openVal(d) * STAGE_P[d.stage], 0)
  const receivable = ds.filter((d) => d.stage === 'satis').reduce((s, d) => s + Number(d.amount ?? 0) - d.payments.reduce((a, p) => a + Number(p.amount), 0), 0)
  const allRev = ds.filter((d) => d.stage === 'satis').reduce((s, d) => s + Number(d.amount ?? 0), 0)

  // Ay sonu tahmini
  const now = new Date(); const dim0 = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const forecast = period === 'bu_ay' && now.getDate() > 2 ? Math.round((cur.rev / now.getDate()) * dim0) : null

  // İçgörüler
  const insights: string[] = []
  if (breakdown[0] && cur.won.length > 1) insights.push(`En çok ciro ${dim === 'kisi' ? '' : 'getiren ' + (dim === 'nis' ? 'niş' : dim === 'semt' ? 'semt' : 'paket') + ': '}${breakdown[0].k} (${tl(breakdown[0].v)}).`)
  const bestCell = heat.flatMap((row, wi) => row.map((c, hi) => ({ wi, h: hi + 9, ...c }))).filter((c) => c.calls >= 5).sort((a, b) => b.ans / b.calls - a.ans / a.calls)[0]
  if (bestCell) insights.push(`Telefonu en çok ${WEEKDAYS[bestCell.wi]} ${bestCell.h}:00–${bestCell.h + 1}:00 arası açıyorlar (%${pct(bestCell.ans, bestCell.calls)}).`)
  if (cur.calls.length >= 20) insights.push(`Her ${Math.max(1, Math.round(cur.calls.length / Math.max(1, cur.meet)))} aramada 1 toplantı çıkıyor${cur.won.length ? `, her ${Math.max(1, Math.round(cur.calls.length / cur.won.length))} aramada 1 satış` : ''}.`)
  if (cur.calls.length && cur.won.length) insights.push(`Bir arama ortalama ${tl(cur.rev / cur.calls.length)} değerinde.`)
  if (lostRows[0] && lostRows[0].v >= 2) insights.push(`En sık kayıp sebebi: ${lostRows[0].k} (${lostRows[0].v} kez).`)
  if (receivable > 0) insights.push(`Tahsil edilmemiş ${tl(receivable)} alacak var.`)
  if (forecast !== null && cur.rev > 0) insights.push(`Bu hızla ay sonu cirosu yaklaşık ${tl(forecast)} olur.`)

  const salesList = [...cur.won].sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="title">Analiz</h1>
        <div className="subtitle">{r[0].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – {r[1].toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      <div className="toolbar">
        {PERIODS.map((p) => <button key={p.k} className={'tab' + (period === p.k ? ' on' : '')} onClick={() => setPeriod(p.k)}>{p.l}</button>)}
        <span className="spacer" />
        <select className="filter" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Herkes</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name.split(' ')[0]}</option>)}
        </select>
      </div>

      <div className="stats stats-6">
        <Kpi k="Ciro" v={cur.rev} prev={hasPrev ? prev.rev : undefined} fmt={tl} hint={forecast ? `Ay sonu tahmini ${tl(forecast)}` : undefined} />
        <Kpi k="Satış" v={cur.won.length} prev={hasPrev ? prev.won.length : undefined} fmt={String} />
        <Kpi k="Ortalama satış" v={cur.avg} prev={hasPrev ? prev.avg : undefined} fmt={tl} />
        <Kpi k="Tahsilat" v={cur.paid} prev={hasPrev ? prev.paid : undefined} fmt={tl} />
        <Kpi k="Arama" v={cur.calls.length} prev={hasPrev ? prev.calls.length : undefined} fmt={String} />
        <Kpi k="Toplantı" v={cur.meet} prev={hasPrev ? prev.meet : undefined} fmt={String} />
      </div>

      {insights.length > 0 && (
        <div className="callout neutral insights">
          <div className="ic">💡</div>
          <ul>{insights.slice(0, 5).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}

      <h2 className="section">Ciro</h2>
      <div className="viz-card">
        <TimeBars data={series.map((b) => ({ label: b.label, sub: b.sub, v: b.rev, extra: b.n ? `${b.n} satış` : undefined }))} fmt={tl} empty="Bu dönemde satış yok." />
      </div>

      <h2 className="section">Satışlar <span className="n">{salesList.length}</span></h2>
      <div className="list">
        {salesList.length === 0 && <div className="empty">Bu dönemde kapanan satış yok.</div>}
        {salesList.map((d) => {
          const paid = d.payments.reduce((s, p) => s + Number(p.amount), 0)
          const amt = Number(d.amount ?? 0)
          return (
            <div className="item" key={d.id}>
              <div className="time">{d.closed_at ? new Date(d.closed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : ''}</div>
              <div className="grow">
                <div className="t">{d.leads?.business_name}</div>
                <div className="s">{[d.package && PACKAGES[d.package]?.label, d.leads?.niche, d.leads?.district, nameOf(d.owner_id ?? d.caller_id)].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{tl(amt)}</div>
                <span className={'tag ' + (paid >= amt ? 'green' : paid > 0 ? 'yellow' : 'red')}>{paid >= amt ? 'Ödendi' : paid > 0 ? `${tl(amt - paid)} kaldı` : 'Ödenmedi'}</span>
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="section">Ciro nereden geliyor?</h2>
      <div className="viz-card">
        <div className="seg">
          {([['nis', 'Niş'], ['semt', 'Semt'], ['paket', 'Paket'], ['kisi', 'Kişi']] as const).map(([k, l]) => (
            <button key={k} className={'tab' + (dim === k ? ' on' : '')} onClick={() => setDim(k)}>{l}</button>
          ))}
        </div>
        <HBars rows={breakdown} fmt={tl} empty="Bu dönemde satış yok." />
      </div>

      <h2 className="section">Huni</h2>
      <div className="viz-card">
        <HBars fmt={String} empty="Bu dönemde arama yok." rows={cur.calls.length ? [
          { k: 'Arama', v: cur.calls.length },
          { k: 'Açtı', v: cur.ans, sub: `%${pct(cur.ans, cur.calls.length)}` },
          { k: 'Toplantı', v: cur.meet, sub: `açanların %${pct(cur.meet, cur.ans)}` },
          { k: 'Satış', v: cur.won.length, sub: `toplantıların %${pct(cur.won.length, cur.meet)}` },
        ] : []} />
      </div>

      <h2 className="section">Aktivite</h2>
      <div className="viz-card">
        <TimeBars data={series.map((b) => ({ label: b.label, sub: b.sub, v: b.calls, extra: `${b.meet} toplantı` }))} fmt={(n) => `${n} arama`} empty="Bu dönemde arama yok." />
      </div>

      <h2 className="section">En iyi arama saatleri</h2>
      <div className="viz-card">
        <div className="seg">
          {([['ans', 'Açma oranı'], ['meet', 'Toplantı oranı'], ['calls', 'Arama sayısı']] as const).map(([k, l]) => (
            <button key={k} className={'tab' + (heatM === k ? ' on' : '')} onClick={() => setHeatM(k)}>{l}</button>
          ))}
        </div>
        <Heat cells={heat} metric={heatM} />
      </div>

      <h2 className="section">Açık hat</h2>
      <div className="stats">
        <Kpi k="Açık anlaşma" v={open.length} fmt={String} />
        <Kpi k="Toplam değer" v={pipeline} fmt={tl} />
        <Kpi k="Beklenen (ağırlıklı)" v={weighted} fmt={tl} hint="Aşamaya göre olasılıkla" />
        <Kpi k="Alacak" v={receivable} fmt={tl} hint="Satıldı, ödenmedi" />
      </div>
      <div className="viz-card" style={{ marginTop: 10 }}>
        <HBars fmt={String} empty="Açık anlaşma yok." rows={STAGES.filter((s) => STAGE_P[s.key] !== undefined).map((s) => {
          const xs = open.filter((d) => d.stage === s.key)
          return { k: s.label, v: xs.length, sub: tl(xs.reduce((a, d) => a + openVal(d), 0)) }
        }).filter((x) => x.v)} />
      </div>

      <div className="viz-2">
        <div>
          <h2 className="section">Kapanış oranı (niş)</h2>
          <div className="viz-card"><HBars rows={nicheConv} fmt={(n) => `%${n}`} empty="En az 2 kapanmış anlaşması olan niş yok." /></div>
        </div>
        <div>
          <h2 className="section">Kayıp sebepleri</h2>
          <div className="viz-card"><HBars rows={lostRows} fmt={String} empty="Bu dönemde kayıp yok." /></div>
        </div>
      </div>

      <h2 className="section">1 milyon hedefi</h2>
      <div className="viz-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 28, letterSpacing: '-0.02em' }}>{tl(allRev)}</b>
          <span className="muted">/ {tl(TARGET)} · %{pct(allRev, TARGET)}</span>
        </div>
        <div className="progress" style={{ height: 10, borderRadius: 5 }}><div style={{ width: `${Math.min(100, (allRev / TARGET) * 100)}%` }} /></div>
        <div className="faint" style={{ marginTop: 8, fontSize: 13 }}>
          {cur.avg > 0 ? `Kalan ${tl(TARGET - allRev)} için ortalama satışla ${Math.ceil((TARGET - allRev) / cur.avg)} satış daha lazım.` : 'Kalan için ortalama satış hesaplanınca kaç satış gerektiği burada görünür.'}
        </div>
      </div>
    </div>
  )
}
