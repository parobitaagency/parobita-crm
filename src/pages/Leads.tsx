import { useCallback, useEffect, useState } from 'react'
import { STATUS, supabase, telHref, type Lead, type LeadStatus } from '../lib/supabase'
import { useSession } from '../lib/session'
import LeadPanel, { type Outcome } from '../components/LeadPanel'

type View = 'aranacak' | 'tekrar' | 'toplanti' | 'tumu'
const VIEWS: { k: View; l: string }[] = [
  { k: 'aranacak', l: 'Aranacaklar' },
  { k: 'tekrar', l: 'Tekrar aranacak' },
  { k: 'toplanti', l: 'Toplantı' },
  { k: 'tumu', l: 'Tümü' },
]
const PAGE = 100
const SELECTABLE: LeadStatus[] = ['yeni', 'toplanti', 'red', 'acmadi', 'sonra_ara']

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export default function Leads() {
  const { me, people, refreshBadges } = useSession()
  const [view, setView] = useState<View>('aranacak')
  const [who, setWho] = useState<string>(me?.id ?? 'all')
  const [niche, setNiche] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<{ lead: Lead; outcome?: Outcome } | null>(null)
  const [niches, setNiches] = useState<string[]>([])

  useEffect(() => {
    supabase.from('leads').select('niche').not('niche', 'is', null).then(({ data }) =>
      setNiches([...new Set((data ?? []).map((d) => d.niche as string))].sort()))
  }, [])

  const load = useCallback(async () => {
    let query = supabase.from('leads').select('*', { count: 'exact' })
    if (who !== 'all') query = query.eq('assigned_to', who)
    if (view === 'aranacak') query = query.in('status', ['yeni', 'acmadi']).order('status', { ascending: false }).order('list_date').order('sort_order')
    if (view === 'tekrar') query = query.eq('status', 'sonra_ara').order('call_back_at', { nullsFirst: true })
    if (view === 'toplanti') query = query.in('status', ['toplanti', 'musteri']).order('updated_at', { ascending: false })
    if (view === 'tumu') query = query.order('updated_at', { ascending: false })
    if (niche) query = query.eq('niche', niche)
    const s = q.trim().replace(/[%,()]/g, '')
    if (s) query = query.or(`business_name.ilike.%${s}%,phone.ilike.%${s}%,district.ilike.%${s}%,address.ilike.%${s}%`)
    const { data, count } = await query.range(0, limit - 1)
    setRows((data ?? []) as Lead[])
    setTotal(count ?? 0)
  }, [who, view, niche, q, limit])

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useEffect(() => setLimit(PAGE), [who, view, niche, q])

  const onSaved = (l: Lead) => setRows((rs) => rs.map((r) => (r.id === l.id ? l : r)))

  const setStatus = async (l: Lead, s: LeadStatus) => {
    if (s === l.status) return
    if (s === 'toplanti' || s === 'sonra_ara') { setOpen({ lead: l, outcome: s }); return }
    if (s === 'yeni') {
      await supabase.from('leads').update({ status: 'yeni' }).eq('id', l.id)
    } else {
      await supabase.from('calls').insert({ lead_id: l.id, user_id: me!.id, outcome: s })
    }
    onSaved({ ...l, status: s })
    refreshBadges()
  }

  const due = (l: Lead) => l.call_back_at && new Date(l.call_back_at) <= new Date()

  return (
    <div className="page wide">
      <div className="page-head">
        <div className="page-icon">☎︎</div>
        <h1 className="title">Lead’ler</h1>
        <div className="subtitle">{total.toLocaleString('tr-TR')} kayıt</div>
        <a className="btn primary" style={{ marginTop: 12 }} href="shortcuts://run-shortcut?name=Parobita%20Ara">▶ Arama seansı başlat</a>
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

      <div className="table-wrap">
        <table className="table sheet">
          <thead>
            <tr>
              <th className="sticky">İşletme</th>
              <th>Telefon</th>
              <th>Durum</th>
              {view === 'tekrar' && <th>Tekrar ara</th>}
              <th>Niş</th>
              <th>Semt</th>
              <th>Puan</th>
              <th>Yorum</th>
              <th>Adres</th>
              <th>Not</th>
              <th>Harita</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="sticky name">
                  {l.phone ? <a className="call-link" href={telHref(l.phone)}>{l.business_name}</a> : l.business_name}
                </td>
                <td className="nowrap">{l.phone ? <a className="call-link muted" href={telHref(l.phone)}>{l.phone}</a> : ''}</td>
                <td>
                  <label className={'tag select-tag ' + STATUS[l.status].tone}>
                    {STATUS[l.status].icon} {STATUS[l.status].label}
                    <select value={l.status} onChange={(e) => setStatus(l, e.target.value as LeadStatus)}>
                      {(l.status === 'musteri' ? [...SELECTABLE, 'musteri' as LeadStatus] : SELECTABLE).map((s) => (
                        <option key={s} value={s}>{STATUS[s].icon} {STATUS[s].label}</option>
                      ))}
                    </select>
                  </label>
                </td>
                {view === 'tekrar' && <td className={'nowrap ' + (due(l) ? 'warn-dot' : 'muted')}>{l.call_back_at ? shortDate(l.call_back_at) : 'Tarih yok'}</td>}
                <td className="muted nowrap">{l.niche}</td>
                <td className="muted nowrap">{l.district}</td>
                <td className="muted nowrap">{l.rating ? `★ ${l.rating}` : ''}</td>
                <td className="muted nowrap">{l.review_count ?? ''}</td>
                <td className="muted clip" title={l.address ?? ''}>{l.address}</td>
                <td className="muted clip" title={l.notes ?? ''}>{l.notes?.replace(/\n/g, ' · ')}</td>
                <td className="nowrap">{l.maps_url ? <a href={l.maps_url} target="_blank" rel="noreferrer" className="muted">Aç ↗</a> : ''}</td>
                <td><button className="icon-btn" title="Detay" onClick={() => setOpen({ lead: l })}>⋯</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <div className="empty">Burada kayıt yok.</div>}
      {rows.length < total && <div className="more" onClick={() => setLimit((n) => n + PAGE)}>↓ {Math.min(PAGE, total - rows.length)} kayıt daha yükle</div>}

      {open && <LeadPanel lead={open.lead} initialOutcome={open.outcome} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </div>
  )
}
