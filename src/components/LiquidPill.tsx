import { useLayoutEffect, useRef } from 'react'

// iOS 26 sekme hapı: yeni sekmeye kayarken uzayıp esner, sonra yerine oturur
export default function LiquidPill({ idx, axis, className }: { idx: number; axis: 'x' | 'y'; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(idx)
  const pos = (i: number) => (axis === 'x' ? `translateX(${i * 100}%)` : `translateY(${i * 38}px)`)
  useLayoutEffect(() => {
    const el = ref.current
    const p = prev.current
    prev.current = idx
    if (!el || p === idx || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const d = Math.abs(idx - p)
    const stretch = 1 + Math.min(0.7, 0.22 * d)
    const squash = axis === 'x' ? `scale(${stretch}, 0.9)` : `scale(0.97, ${stretch})`
    const settle = axis === 'x' ? 'scale(0.96, 1.05)' : 'scale(1.02, 0.96)'
    el.animate(
      [
        { transform: `${pos(p)} scale(1, 1)` },
        { transform: `${pos(p + (idx - p) * 0.5)} ${squash}`, offset: 0.42 },
        { transform: `${pos(idx)} ${settle}`, offset: 0.78 },
        { transform: `${pos(idx)} scale(1, 1)` },
      ],
      { duration: 380 + d * 60, easing: 'cubic-bezier(.25,.8,.25,1)' },
    )
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className={className} style={{ transform: pos(idx) }} />
}
