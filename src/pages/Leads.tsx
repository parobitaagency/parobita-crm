import { useCallback, useEffect, useState } from 'react'
import { STATUS, supabase, type Lead } from '../lib/supabase'
import { useSession } from '../lib/session'
import LeadPanel from '../components/LeadPanel'

type View = 'aranacak' | 'tekrar' | 'toplanti' | 'tumu'
const VIEWS: { k: View; l: string }[] = [
  { k: 'aranacak', l: 'Aranacaklar' },
  { k: 'tekrar', l: 'Tekrar aranacak' },
  { k: 'toplanti', l: 'Toplantı' },
  { k: 'tumu', l: 'Tümü' },
]
const PAGE = 100

export default function Leads() {
  const { me, people } = useSession()
  const [view, setView] = useState<View>('aranacak')
  const [who, setWho] = useState<string>(me?.role === 'owner' ? me.id : 'me')
  const [niche, setNiche] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<Lead | null>(null)
  const [niches, setNiches] = useState<string[]>([])

  useEffect(() => {
    supabase.from('leads').select('niche').not('niche', 'is', null).then(({ data }) =>
      setNiches([...new Set((data ?? []).map((d) => d.niche as string))].sort()))
  }, [])

  const load = useCallback(async () => {
    let query = supabase.from('leads').select('*', { count: 'exact' })
    if (who !== 'all') query = query.eq('assigned_to', who === 'me' ? me!.id : who)
    if (view === 'aranacak') query = query.in('status', ['yeni', 'acmadi']).order('status', { ascending: false }).order('list_date').order('sort_order')
    if (view === 'tekrar') query = query.eq('status', 'sonra_ara').order('call_back_at', { nullsFirst: true })
    if (view === 'toplanti') query = query.in('status', ['toplanti', 'musteri']).order('updated_at', { ascending: false })
    if (view === 'tumu') query = query.order('updated_at', { ascending: false })
    if (niche) query = query.eq('niche', niche)
    if (q.trim()) query = query.or(`business_name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%,district.ilike.%${q.trim()}%`)
    const { data, count } = await query.range(0, limit - 1)
    setRows((data ?? []) as Lead[])
    setTotal(count ?? 0)
  }, [who, view, niche, q, limit, me])

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useEffect(() => setLimit(PAGE), [who, view, niche, q])

  const onSaved = (l: Lead) => setRows((rs) => rs.map((r) => (r.id === l.id ? l : r)))
  const due = (l: Lead) => l.call_back_at && new Date(l.call_back_at) <= new Date()

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-icon">☎︎</div>
        <h1 className="title">Lead’ler</h1>
        <div className="subtitle">{total.toLocaleString('tr-TR')} kayıt</div>
      </div>

      <div className="toolbar">
        {VIEWS.map((v) => <button key={v.k} className={'tab' + (view === v.k ? ' on' : '')} onClick={() => setView(v.k)}>{v.l}</button>)}
        <span className="spacer" />
        {me?.role === 'owner' && (
          <select className="filter" value={who} onChange={(e) => setWho(e.target.value)}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            <option value="all">Herkes</option>
          </select>
        )}
        <select className="filter" value={niche} onChange={(e) => setNiche(e.target.value)}>
          <option value="">Tüm nişler</option>
          {niches.map((n) => <option key={n}>{n}</option>)}
        </select>
        <input className="search" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <table className="table desktop-only">
        <thead><tr><th>İşletme</th><th>Durum</th><th>Telefon</th><th>Niş</th><th>Semt</th><th>Puan</th>{view === 'tekrar' && <th>Tekrar ara</th>}</tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="row" onClick={() => setOpen(l)}>
              <td className="name">{l.business_name}</td>
              <td><span className={'tag ' + STATUS[l.status].tone}>{STATUS[l.status].icon} {STATUS[l.status].label}</span></td>
              <td className="muted nowrap">{l.phone}</td>
              <td className="muted">{l.niche}</td>
              <td className="muted">{l.district}</td>
              <td className="muted nowrap">{l.rating ? `★ ${l.rating}` : ''}{l.review_count ? <span className="faint"> ({l.review_count})</span> : ''}</td>
              {view === 'tekrar' && <td className={'nowrap ' + (due(l) ? 'warn-dot' : 'muted')}>{l.call_back_at ? new Date(l.call_back_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : 'Tarih yok'}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="list mobile-only">
        {rows.map((l) => (
          <div key={l.id} className="item" onClick={() => setOpen(l)}>
            <div className="grow">
              <div className="t">{l.business_name}</div>
              <div className="s">{[l.niche, l.district, l.rating ? `★ ${l.rating}` : null].filter(Boolean).join(' · ')}</div>
            </div>
            {l.status !== 'yeni' && <span className={'tag ' + STATUS[l.status].tone}>{STATUS[l.status].icon}</span>}
          </div>
        ))}
      </div>

      {rows.length === 0 && <div className="empty">Burada kayıt yok.</div>}
      {rows.length < total && <div className="more" onClick={() => setLimit((n) => n + PAGE)}>↓ {Math.min(PAGE, total - rows.length)} kayıt daha yükle</div>}

      {open && <LeadPanel lead={open} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </div>
  )
}
