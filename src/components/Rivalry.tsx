import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Row { id: string; full_name: string; week_calls: number; week_meetings: number; today_calls: number; escapes: number; finished: number; ezik: number }

export const LEVELS = [
  { e: '👑', t: 'Makine' },
  { e: '😐', t: 'Bahaneci' },
  { e: '🐢', t: 'Kaplumbağa' },
  { e: '🛋️', t: 'Koltuk Patatesi' },
  { e: '🤡', t: 'Ezik' },
]
export const level = (n: number) => LEVELS[Math.min(n, LEVELS.length - 1)]

export default function Rivalry() {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    supabase.from('rivalry').select('*').then(({ data }) => setRows((data ?? []) as Row[]))
  }, [])
  if (rows.length < 2) return null
  const topCalls = Math.max(...rows.map((r) => r.week_calls))
  return (
    <>
      <h2 className="section">Bu hafta</h2>
      <div className="rivals">
        {rows.map((r) => {
          const lv = level(r.ezik)
          return (
            <div key={r.id} className="rival">
              <div className="rival-head">
                <span className="rival-name">{r.full_name.split(' ')[0]}</span>
                {r.week_calls > 0 && r.week_calls === topCalls && <span title="Haftanın en çok arayanı">🏆</span>}
              </div>
              <div className={'rival-level' + (r.ezik > 0 ? ' bad' : '')}>{lv.e} {lv.t}</div>
              <div className="rival-stats">
                <div><b>{r.today_calls}</b><span>bugün</span></div>
                <div><b>{r.week_calls}</b><span>hafta arama</span></div>
                <div><b>{r.week_meetings}</b><span>toplantı</span></div>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                🏁 {r.finished} maraton bitti · 🏃‍♂️💨 {r.escapes} kaçış
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
