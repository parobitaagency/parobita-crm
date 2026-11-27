import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from './lib/session'
import { supabase } from './lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { hardReload } from './components/ErrorBoundary'
import { prefetchAll } from './lib/prefetch'
import LiquidPill from './components/LiquidPill'
import TabBar, { pillCtl } from './components/TabBar'
import Login from './pages/Login'
import Today from './pages/Today'
import Leads from './pages/Leads'
import Meetings from './pages/Meetings'
import Deals from './pages/Deals'
import Analytics from './pages/Analytics'

const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
const NAV = [
  { to: '/', label: 'Bugün', icon: <svg {...sv}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg> },
  { to: '/leadler', label: 'Lead’ler', icon: <svg {...sv}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg> },
  { to: '/toplantilar', label: 'Toplantılar', icon: <svg {...sv}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg> },
  { to: '/satislar', label: 'Satışlar', icon: <svg {...sv}><path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5L21 12l-8.5 8.5z" /><circle cx="8" cy="8" r="1.3" /></svg> },
  { to: '/analiz', label: 'Analiz', icon: <svg {...sv}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg> },
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

  return <Shell warn={warn} name={me.full_name} />
}

function Shell({ warn, name }: { warn: number; name: string }) {
  const loc = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const idx = Math.max(0, NAV.findIndex((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to))))
  const lastIdx = useRef(idx)
  const dirRef = useRef('n')
  const swipeNav = useRef(false)
  if (idx !== lastIdx.current) { dirRef.current = (swipeNav.current ? 's' : '') + (idx > lastIdx.current ? 'r' : 'l'); swipeNav.current = false; lastIdx.current = idx }
  const dir = dirRef.current
  const navigate = useNavigate()
  useEffect(() => {
    const el = mainRef.current; if (!el) return
    el.scrollTop = 0; setScrolled(false)
    const on = () => setScrolled(el.scrollTop > 56)
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [loc.pathname])

  // Sayfalar arasında parmakla sağa-sola kaydırma
  useEffect(() => {
    const main = mainRef.current; if (!main) return
    let st: { x: number; y: number; t: number; lock: '' | 'h' | 'v'; dx: number; sc: HTMLElement | null } | null = null
    const route = () => main.querySelector('.route') as HTMLElement | null
    const hScroller = (t: HTMLElement | null) => {
      for (let el = t; el && el !== main; el = el.parentElement) {
        const ox = getComputedStyle(el).overflowX
        if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2) return el
      }
      return null
    }
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !matchMedia('(max-width: 760px)').matches) return
      const t = e.target as HTMLElement
      if (t.closest('.panel, .scrim, input, textarea, select, .tg-body')) return
      st = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), lock: '', dx: 0, sc: hScroller(t) }
    }
    const moveT = (e: TouchEvent) => {
      if (!st) return
      const dx = e.touches[0].clientX - st.x, dy = e.touches[0].clientY - st.y
      if (!st.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        st.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v'
        // İç içe yatay kaydırma: önce tablo kayar, kenara gelmişse sayfa kayar
        if (st.lock === 'h' && st.sc) {
          const sc = st.sc, atStart = sc.scrollLeft <= 1, atEnd = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 1
          if (!((dx > 0 && atStart) || (dx < 0 && atEnd))) { st = null; return }
          st.x = e.touches[0].clientX
        }
      }
      if (st.lock !== 'h') return
      e.preventDefault()
      const w = main.clientWidth
      const hasNext = dx < 0 ? idx < NAV.length - 1 : idx > 0
      const eff = hasNext ? dx : dx * 0.25
      st.dx = eff
      const r = route(); if (r) { r.style.transition = 'none'; r.style.animation = 'none'; r.style.transform = `translateX(${eff}px)`; r.style.opacity = String(1 - Math.min(0.35, Math.abs(eff) / w * 0.5)) }
      if (hasNext) pillCtl.live(idx - eff / w)
    }
    const end = () => {
      if (!st) return
      const s = st; st = null
      if (s.lock !== 'h') return
      const w = main.clientWidth, v = Math.abs(s.dx) / Math.max(1, Date.now() - s.t)
      const target = s.dx < 0 ? idx + 1 : idx - 1
      const r = route()
      if ((Math.abs(s.dx) > w * 0.22 || v > 0.45) && target >= 0 && target < NAV.length) {
        if (r) { r.style.transition = 'transform .2s cubic-bezier(.4,0,.8,.6), opacity .2s'; r.style.transform = `translateX(${s.dx < 0 ? -w * 0.5 : w * 0.5}px)`; r.style.opacity = '0' }
        pillCtl.from = idx - s.dx / w
        swipeNav.current = true
        setTimeout(() => navigate(NAV[target].to), 140)
      } else {
        if (r) { r.style.transition = 'transform .45s cubic-bezier(.34,1.35,.64,1), opacity .3s'; r.style.transform = ''; r.style.opacity = '' }
        pillCtl.live(null); pillCtl.from = idx - s.dx / w
        // hap geri yaylansın
        const el = document.querySelector('.tab-pill') as HTMLElement | null
        if (el) { el.animate([{ transform: `translateX(${(idx - s.dx / w) * 100}%)` }, { transform: `translateX(${idx * 100}%)` }], { duration: 420, easing: 'cubic-bezier(.34,1.4,.64,1)' }); el.style.transform = `translateX(${idx * 100}%)` }
        pillCtl.from = null
      }
    }
    main.addEventListener('touchstart', start, { passive: true })
    main.addEventListener('touchmove', moveT, { passive: false })
    main.addEventListener('touchend', end)
    main.addEventListener('touchcancel', end)
    return () => { main.removeEventListener('touchstart', start); main.removeEventListener('touchmove', moveT); main.removeEventListener('touchend', end); main.removeEventListener('touchcancel', end) }
  }, [idx, navigate])
  return (
    <div className={'app' + (scrolled ? ' scrolled' : '')}>
      <aside className="side">
        <div className="ws"><span className="ws-icon">P</span>Parobita</div>
        <div className="side-nav" style={{ ['--i' as string]: idx }}>
          <LiquidPill idx={idx} axis="y" className="side-pill" />
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              {n.icon}
              {n.label}
              {n.to === '/toplantilar' && warn > 0 && <span className="count warn">{warn}</span>}
            </NavLink>
          ))}
        </div>
        <div className="foot">
          {name} · <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut() }}>Çıkış</a>
        </div>
      </aside>
      <div className="topbar" aria-hidden={!scrolled}><span>{NAV[idx]?.label}</span></div>
      <main className="main" ref={mainRef}>
        <div className={'route dir-' + dir} key={loc.pathname}>
          <Routes location={loc}>
            <Route path="/" element={<Today />} />
            <Route path="/leadler" element={<Leads />} />
            <Route path="/toplantilar" element={<Meetings />} />
            <Route path="/satislar" element={<Deals />} />
            <Route path="/analiz" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
      <TabBar items={NAV} idx={idx} badge={(to) => (to === '/toplantilar' ? warn : 0)} />
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
