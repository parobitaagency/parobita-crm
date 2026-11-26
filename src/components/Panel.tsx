import { useEffect, type ReactNode } from 'react'

export default function Panel({ onClose, children, actions }: { onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="panel">
        <div className="panel-top">
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">✕</button>
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
