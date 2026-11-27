import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './lib/session'
import { supabase } from './lib/supabase'
import { useEffect, useState } from 'react'
import { hardReload } from './components/ErrorBoundary'
import { prefetchAll } from './lib/prefetch'
import Login from './pages/Login'
import Today from './pages/Today'
import Leads from './pages/Leads'
import Meetings from './pages/Meetings'
import Deals from './pages/Deals'

const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
const NAV = [
  { to: '/', label: 'Bugün', icon: <svg {...sv}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg> },
  { to: '/leadler', label: 'Lead’ler', icon: <svg {...sv}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg> },
  { to: '/toplantilar', label: 'Toplantılar', icon: <svg {...sv}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg> },
  { to: '/satislar', label: 'Satışlar', icon: <svg {...sv}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg> },
]

export default function App() {
  const { session, me, badges, marathon, loading } = useSession()
  useEffect(() => {
    if (!me) return
    const t = setTimeout(() => prefetchAll(me.id), 1500)
    return () => clearTimeout(t)
  }, [me])
  if (loading) return <Loading />
  if (!session) return <Login />
  if (!me)
    return (
      <div className="login"><div className="box">
        <h1>{navigator.onLine ? 'Hesap hazır değil' : 'İnternet yok'}</h1>
        <p className="muted">{navigator.onLine ? 'Bu e-posta için profil tanımlanmamış. Burak\'a haber ver.' : 'Uygulamayı bir kere internetliyken aç; sonra internetsiz de çalışır.'}</p>
        {!navigator.onLine && <button className="btn" style={{ marginRight: 8 }} onClick={() => location.reload()}>Tekrar dene</button>}
        <button className="btn" onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
      </div></div>
    )

  const warn = badges.missing + badges.awaiting

  if (marathon)
    return (
      <div className="login"><div className="box" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🏃</div>
        <h1>Maraton devam ediyor</h1>
        <div style={{ fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums', margin: '8px 0' }}>{marathon.done}/{marathon.target}</div>
        <div className="progress" style={{ marginBottom: 20 }}><div style={{ width: `${(marathon.done / marathon.target) * 100}%` }} /></div>
        <p className="muted">{marathon.target - marathon.done} arama kaldı. Bitmeden buradan çıkış yok.</p>
        <a className="btn primary big" style={{ width: '100%' }} href="shortcuts://run-shortcut?name=Parobita%20Ara">▶ Devam et</a>
      </div></div>
    )

  return (
    <div className="app">
      <aside className="side">
        <div className="ws"><span className="ws-icon">P</span>Parobita</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            {n.icon}
            {n.label}
            {n.to === '/toplantilar' && warn > 0 && <span className="count warn">{warn}</span>}
          </NavLink>
        ))}
        <div className="foot">
          {me.full_name} · <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }}>Çıkış</a>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/leadler" element={<Leads />} />
          <Route path="/toplantilar" element={<Meetings />} />
          <Route path="/satislar" element={<Deals />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            {n.icon}
            {n.label}
            {n.to === '/toplantilar' && warn > 0 && <span className="badge">{warn}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Loading() {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t) }, [])
  return (
    <div className="login"><div className="box" style={{ textAlign: 'center' }}>
      <p className="muted">Yükleniyor…</p>
      {slow && (
        <>
          <p className="faint" style={{ fontSize: 13 }}>Uzun sürdü. İnternet bağlantını kontrol et ya da önbelleği temizle.</p>
          <button className="btn" onClick={hardReload}>Önbelleği temizle ve yenile</button>
        </>
      )}
    </div></div>
  )
}
