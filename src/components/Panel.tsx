import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export default function Panel({ onClose, children, actions }: { onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const [closing, setClosing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number; t: number } | null>(null)
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 260)
  }, [closing, onClose])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [close])

  // Telefonda: üst kısmından aşağı çekince kapanır (iOS sayfası gibi)
  const mobile = () => matchMedia('(max-width: 760px)').matches
  const onDown = (e: React.PointerEvent) => {
    if (!mobile() || (e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, dy: 0, t: Date.now() }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !ref.current) return
    const raw = e.clientY - d.y
    d.dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2
    ref.current.style.animation = 'none'
    ref.current.style.transition = 'none'
    ref.current.style.transform = `translateY(${d.dy}px)`
  }
  const onUp = () => {
    const d = drag.current; drag.current = null; if (!d || !ref.current) return
    const v = d.dy / Math.max(1, Date.now() - d.t)
    ref.current.style.transition = 'transform .45s cubic-bezier(.34,1.3,.64,1)'
    if (d.dy > 120 || v > 0.8) { ref.current.style.transition = 'transform .28s cubic-bezier(.4,0,.6,1)'; ref.current.style.transform = 'translateY(110%)'; setClosing(true); setTimeout(onClose, 260) }
    else ref.current.style.transform = ''
  }

  return (
    <>
      <div className={'scrim' + (closing ? ' out' : '')} onClick={close} />
      <div className={'panel' + (closing && !drag.current ? ' out' : '')} ref={ref}>
        <div className="panel-top" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: 'none' }}>
          <button className="icon-btn" onClick={close} aria-label="Kapat">✕</button>
          <span className="spacer" />
          {actions}
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </>
  )
}

export function Prop({ k, children }: { k: string; children: ReactNode }) {
  return (
    <>
      <div className="pk">{k}</div>
      <div className="pv">{children}</div>
    </>
  )
}

/** datetime-local girişi için yerel saat biçimi */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
