import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

type Item = { to: string; label: string; icon: ReactNode }

// Sayfa kaydırma jesti hapı canlı sürebilsin diye
export const pillCtl: { live: (f: number | null) => void; from: number | null } = { live: () => {}, from: null }

const pos = (f: number) => `translateX(${f * 100}%)`

export default function TabBar({ items, idx, badge }: { items: Item[]; idx: number; badge: (to: string) => number }) {
  const nav = useNavigate()
  const bar = useRef<HTMLElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const prev = useRef(idx)
  const g = useRef<{ x0: number; f: number; scrub: boolean; id: number } | null>(null)
  const n = items.length

  const slot = () => { const r = bar.current!.getBoundingClientRect(); return { left: r.left + 6, w: (r.width - 12) / n } }
  const fAt = (x: number) => { const s = slot(); return Math.max(0, Math.min(n - 1, (x - s.left) / s.w - 0.5)) }

  pillCtl.live = (f) => {
    const el = pill.current; if (!el) return
    if (f === null) { el.classList.remove('lens'); return }
    el.getAnimations().forEach((a) => a.cancel())
    el.classList.add('lens')
    el.style.transform = `${pos(Math.max(-0.15, Math.min(n - 0.85, f)))} scale(1.06, 0.96)`
  }

  // Sekme değişince: uzayıp esneyerek kay
  useLayoutEffect(() => {
    const el = pill.current; if (!el) return
    const from = pillCtl.from ?? prev.current
    pillCtl.from = null
    prev.current = idx
    el.classList.remove('lens')
    el.style.transform = pos(idx)
    if (Math.abs(from - idx) < 0.01 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const d = Math.abs(idx - from)
    const stretch = 1 + Math.min(0.75, 0.25 * d)
    el.animate([
      { transform: `${pos(from)} scale(1.08, 0.97)` },
      { transform: `${pos(from + (idx - from) * 0.55)} scale(${stretch}, 0.86)`, offset: 0.4 },
      { transform: `${pos(idx + (idx > from ? 0.04 : -0.04))} scale(0.94, 1.07)`, offset: 0.72 },
      { transform: `${pos(idx)} scale(1.02, 0.99)`, offset: 0.88 },
      { transform: `${pos(idx)} scale(1, 1)` },
    ], { duration: 420 + d * 70, easing: 'cubic-bezier(.3,.75,.25,1)' })
  }, [idx])

  const down = (e: React.PointerEvent) => {
    if (e.button > 0) return
    bar.current!.setPointerCapture(e.pointerId)
    g.current = { x0: e.clientX, f: idx, scrub: false, id: e.pointerId }
    bar.current!.classList.add('pressing')
  }
  const move = (e: React.PointerEvent) => {
    const s = g.current; if (!s) return
    if (!s.scrub && Math.abs(e.clientX - s.x0) < 6) return
    s.scrub = true
    s.f = fAt(e.clientX)
    const el = pill.current!
    el.getAnimations().forEach((a) => a.cancel())
    el.classList.add('lens')
    el.style.transform = `${pos(s.f)} scale(1.16, 1.1)`
  }
  const up = (e: React.PointerEvent) => {
    const s = g.current; g.current = null
    bar.current!.classList.remove('pressing')
    if (!s) return
    const target = s.scrub ? Math.round(s.f) : Math.round(fAt(e.clientX))
    pillCtl.from = s.scrub ? s.f : null
    if (target !== idx) nav(items[target].to)
    else if (s.scrub) { // aynı sekmeye geri bırakıldı
      prev.current = s.f
      const el = pill.current!
      el.classList.remove('lens')
      el.animate([{ transform: `${pos(s.f)} scale(1.1, 1.05)` }, { transform: pos(idx) }], { duration: 380, easing: 'cubic-bezier(.34,1.4,.64,1)' })
      el.style.transform = pos(idx)
      pillCtl.from = null
    }
  }
  const cancel = () => { g.current = null; bar.current?.classList.remove('pressing'); pillCtl.live(null); if (pill.current) pill.current.style.transform = pos(idx) }

  return (
    <nav className="tabbar" ref={bar} style={{ ['--n' as string]: n }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <span ref={pill} className="tab-pill" style={{ transform: pos(idx) }} />
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end className={({ isActive }) => (isActive ? 'active' : '')} draggable={false}
          onClick={(e) => { if (e.detail !== 0) e.preventDefault() }}>
          {it.icon}
          {it.label}
          {badge(it.to) > 0 && <span className="badge">{badge(it.to)}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
