import { useCallback, useEffect, useState } from 'react'
import { STATUS, supabase, telHref, type Lead, type LeadStatus } from '../lib/supabase'
import { useSession } from '../lib/session'
import LeadPanel, { type Outcome } from '../components/LeadPanel'
import { dirUrl, fmtKm, geocodeMissing, km, useBase, type Pt } from '../lib/geo'

type View = 'aranacak' | 'tekrar' | 'toplanti' | 'tumu'
const VIEWS: { k: View; l: string }[] = [
  { k: 'aranacak', l: 'Aranacaklar' },
  { k: 'tekrar', l: 'Tekrar aranacak' },
  { k: 'toplanti', l: 'Toplantı' },
  { k: 'tumu', l: 'Tümü' },
]
const PAGE = 100
const CHIPS: LeadStatus[] = ['yeni', 'acmadi', 'sonra_ara', 'wp', 'uzun_vade', 'red', 'toplanti', 'musteri', 'gecersiz']
type DateF = '' | 'bugun' | 'hafta' | 'ay'
type Sort = 'varsayilan' | 'yakin' | 'konum' | 'guncel' | 'puan' | 'yorum' | 'isim'
const store = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem('pb-lf-' + k); return v ? JSON.parse(v) as T : d } catch { return d } }
const SELECTABLE: LeadStatus[] = ['yeni', 'toplanti', 'red', 'acmadi', 'sonra_ara', 'wp', 'uzun_vade', 'gecersiz']

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
  const [statuses, setStatuses] = useState<LeadStatus[]>(() => store('st', []))
  const [district, setDistrict] = useState<string>(() => store('dist', ''))
  const [dateF, setDateF] = useState<DateF>(() => store('date', ''))
  const [sort, setSort] = useState<Sort>(() => store('sort', 'varsayilan'))
  const [counts, setCounts] = useState<Partial<Record<LeadStatus, number>>>({})
  const [districts, setDistricts] = useState<string[]>([])
  const [showF, setShowF] = useState(false)
  const base = useBase()
  const [here, setHere] = useState<Pt | null>(() => store('here', null))
  const [locErr, setLocErr] = useState('')
  const origin: Pt | null = sort === 'konum' ? here : base
  const askLocation = () => {
    setLocErr('')
    navigator.geolocation?.getCurrentPosition(
      (p) => { const h = { lat: p.coords.latitude, lng: p.coords.longitude }; setHere(h); localStorage.setItem('pb-lf-here', JSON.stringify(h)) },
      () => { setLocErr('Konum alınamadı — ofise göre sıralandı'); setSort('yakin') },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    )
  }
  useEffect(() => { if (sort === 'konum') askLocation() }, [sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const mineView = who === me?.id
  // Arama seansı (kısayol) bu sıralama ve filtrelerle arasın
  useEffect(() => {
    if (!mineView || !me) return
    const prefs: Record<string, unknown> = { sort: sort === 'konum' ? 'yakin' : sort === 'varsayilan' ? 'liste' : sort }
    if (niche) prefs.niche = niche
    if (district) prefs.district = district
    const callable = statuses.filter((x) => ['yeni', 'acmadi', 'sonra_ara', 'wp', 'uzun_vade'].includes(x))
    if (callable.length) prefs.statuses = callable
    if (sort === 'konum' && here) { prefs.olat = here.lat; prefs.olng = here.lng }
    supabase.from('profiles').update({ call_prefs: prefs }).eq('id', me.id).then(() => {})
  }, [mineView, me, sort, niche, district, statuses, here])
  useEffect(() => {
    localStorage.setItem('pb-lf-st', JSON.stringify(statuses)); localStorage.setItem('pb-lf-dist', JSON.stringify(district))
    localStorage.setItem('pb-lf-date', JSON.stringify(dateF)); localStorage.setItem('pb-lf-sort', JSON.stringify(sort))
  }, [statuses, district, dateF, sort])
  const activeF = statuses.length + (district ? 1 : 0) + (dateF ? 1 : 0) + (sort !== 'varsayilan' ? 1 : 0)
  const clearF = () => { setStatuses([]); setDistrict(''); setDateF(''); setSort('varsayilan') }
  const toggle = (st: LeadStatus) => setStatuses((xs) => (xs.includes(st) ? xs.filter((x) => x !== st) : [...xs, st]))

  useEffect(() => {
    supabase.from('leads').select('niche, district').then(({ data }) => {
      setNiches([...new Set((data ?? []).map((d) => d.niche as string).filter(Boolean))].sort())
      const freq = new Map<string, number>()
      ;(data ?? []).forEach((d) => { const k = ((d.district as string) || '').split(/[\/(,]/)[0].trim(); if (k) freq.set(k, (freq.get(k) ?? 0) + 1) })
      setDistricts([...freq].filter(([, n]) => n >= 2).sort((a, b) => a[0].localeCompare(b[0], 'tr')).map(([k]) => k))
    })
  }, [])

  // Durum çiplerindeki sayılar
  useEffect(() => {
    let alive = true
    Promise.all(CHIPS.map(async (st) => {
      let qq = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', st)
      if (who !== 'all') qq = qq.eq('assigned_to', who)
      if (niche) qq = qq.eq('niche', niche)
      if (district) qq = qq.ilike('district', `%${district}%`)
      const { count } = await qq
      return [st, count ?? 0] as const
    })).then((xs) => alive && setCounts(Object.fromEntries(xs)))
    return () => { alive = false }
  }, [who, niche, district, rows])

  const load = useCallback(async () => {
    let query = supabase.from('leads').select('*', { count: 'exact' })
    if (who !== 'all') query = query.eq('assigned_to', who)
    if (statuses.length) query = query.in('status', statuses)
    else if (view === 'aranacak') query = query.in('status', ['yeni', 'acmadi'])
    else if (view === 'tekrar') query = query.in('status', ['sonra_ara', 'wp', 'uzun_vade'])
    else if (view === 'toplanti') query = query.in('status', ['toplanti', 'musteri'])
    if (niche) query = query.eq('niche', niche)
    if (district) query = query.ilike('district', `%${district}%`)
    if (dateF) {
      const d = new Date(); d.setHours(0, 0, 0, 0)
      if (dateF === 'hafta') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      if (dateF === 'ay') d.setDate(1)
      query = query.gte('list_date', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    const byDist = sort === 'yakin' || sort === 'konum'
    if (byDist) query = query.order('updated_at', { ascending: false })
    else if (sort === 'guncel') query = query.order('updated_at', { ascending: false })
    else if (sort === 'puan') query = query.order('rating', { ascending: false, nullsFirst: false })
    else if (sort === 'yorum') query = query.order('review_count', { ascending: false, nullsFirst: false })
    else if (sort === 'isim') query = query.order('business_name')
    else if (!statuses.length && view === 'aranacak') query = query.order('status', { ascending: false }).order('list_date').order('sort_order')
    else if (!statuses.length && view === 'tekrar') query = query.order('call_back_at', { nullsFirst: true })
    else query = query.order('updated_at', { ascending: false })
    const s = q.trim().replace(/[%,()]/g, '')
    if (s) query = query.or(`business_name.ilike.%${s}%,phone.ilike.%${s}%,district.ilike.%${s}%,address.ilike.%${s}%`)
    const { data, count } = await query.range(0, byDist ? 1999 : limit - 1)
    let list = (data ?? []) as Lead[]
    if (byDist && origin) {
      // Önce tekrar aranacaklar, sonra yakından uzağa
      list = [...list].sort((a, b) => {
        const cbk = (x: Lead) => (['sonra_ara', 'wp', 'uzun_vade'].includes(x.status) ? 0 : 1); const sa = cbk(a), sb = cbk(b)
        if (!statuses.length && view === 'aranacak' && sa !== sb) return sa - sb
        return (km(origin, a) ?? 1e9) - (km(origin, b) ?? 1e9)
      }).slice(0, limit)
    }
    setRows(list)
    geocodeMissing(list as never, (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r))))
    setTotal(count ?? 0)
  }, [who, view, niche, q, limit, statuses, district, dateF, sort, origin?.lat, origin?.lng])

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useEffect(() => setLimit(PAGE), [who, view, niche, q, statuses, district, dateF, sort])

  const onSaved = (l: Lead) => setRows((rs) => rs.map((r) => (r.id === l.id ? l : r)))

  const setStatus = async (l: Lead, s: LeadStatus) => {
    if (s === l.status) return
    if (s === 'toplanti' || s === 'sonra_ara' || s === 'wp' || s === 'uzun_vade') { setOpen({ lead: l, outcome: s }); return }
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
        {VIEWS.map((v) => <button key={v.k} className={'tab' + (view === v.k && !statuses.length ? ' on' : '')} onClick={() => { setView(v.k); setStatuses([]) }}>{v.l}</button>)}
        <button className={'tab filter-btn' + (showF || activeF ? ' on' : '')} onClick={() => setShowF((x) => !x)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filtre{activeF ? ` · ${activeF}` : ''}
        </button>
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

      {(showF || statuses.length > 0) && (
        <div className="filters">
          <div className="chips">
            {CHIPS.map((st) => (
              <button key={st} className={'chip status-chip ' + STATUS[st].tone + (statuses.includes(st) ? ' on' : '')} onClick={() => toggle(st)}>
                {STATUS[st].icon && <span>{STATUS[st].icon}</span>}{STATUS[st].label}<span className="cnt">{counts[st] ?? '·'}</span>
              </button>
            ))}
          </div>
          {showF && (
            <div className="filter-row">
              <select className="filter" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">Tüm semtler</option>
                {districts.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select className="filter" value={dateF} onChange={(e) => setDateF(e.target.value as DateF)}>
                <option value="">Tüm liste tarihleri</option>
                <option value="bugun">Bugünün listesi</option>
                <option value="hafta">Bu haftanın listeleri</option>
                <option value="ay">Bu ayın listeleri</option>
              </select>
              <select className="filter" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="varsayilan">Sıralama: arama sırası</option>
                <option value="yakin">📍 Yakından uzağa (ofis)</option>
                <option value="konum">📍 Yakından uzağa (konumum)</option>
                <option value="guncel">Son güncellenen</option>
                <option value="puan">En yüksek puan</option>
                <option value="yorum">En çok yorum</option>
                <option value="isim">İsme göre (A–Z)</option>
              </select>
              {activeF > 0 && <button className="btn ghost" onClick={clearF}>Temizle</button>}
            </div>
          )}
          {mineView && <div className="faint" style={{ fontSize: 12 }}>▶ Arama seansı bu sıralama ve filtrelerle arar{locErr ? ` · ${locErr}` : ''}</div>}
        </div>
      )}

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
              <th>Mesafe</th>
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
                <td className="muted nowrap">{fmtKm(km(origin ?? base, l))}</td>
                <td className="muted nowrap">{l.rating ? `★ ${l.rating}` : ''}</td>
                <td className="muted nowrap">{l.review_count ?? ''}</td>
                <td className="muted clip" title={l.address ?? ''}>{l.address}</td>
                <td className="muted clip" title={l.notes ?? ''}>{l.notes?.replace(/\n/g, ' · ')}</td>
                <td className="nowrap">{l.maps_url ? <a href={l.maps_url} target="_blank" rel="noreferrer" className="muted">Aç ↗</a> : ''}{dirUrl(l) && <> · <a href={dirUrl(l)!} target="_blank" rel="noreferrer" className="muted">Yol ↗</a></>}</td>
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
