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

const NAV = [
  { to: '/', icon: '☀︎', label: 'Bugün' },
  { to: '/leadler', icon: '☎︎', label: 'Lead’ler' },
  { to: '/toplantilar', icon: '◷', label: 'Toplantılar' },
  { to: '/satislar', icon: '◆', label: 'Satışlar' },
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
        <h1>Hesap hazır değil</h1>
        <p className="muted">Bu e-posta için profil tanımlanmamış. Burak'a haber ver.</p>
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
            <span style={{ width: 18, textAlign: 'center' }}>{n.icon}</span>
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
            <span className="i">{n.icon}</span>
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
