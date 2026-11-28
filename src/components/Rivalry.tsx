import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Row { id: string; full_name: string; week_calls: number; week_meetings: number; today_calls: number; escapes: number; finished: number; ezik: number }

export const LEVELS = [
  { e: '💰', t: 'Milyarder' },
  { e: '😐', t: 'Bahaneci' },
  { e: '🐢', t: 'Kaplumbağa' },
  { e: '🛋️', t: 'Koltuk Pezevengi' },
  { e: '🤡', t: 'Fakir' },
]
export const level = (n: number) => LEVELS[Math.min(n, LEVELS.length - 1)]

/** Günlük arama hedefi (kişi başı). */
export const DAILY_TARGET = 100

const dayStart = (offset: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset); return d }

async function callsOn(uid: string, offset: number) {
  const s = dayStart(offset), e = new Date(s.getTime() + 86400000)
  const { count } = await supabase.from('calls').select('id', { count: 'exact', head: true })
    .eq('user_id', uid).gte('called_at', s.toISOString()).lt('called_at', e.toISOString())
  return count ?? 0
}

/** Hedefin tutturulduğu ardışık gün sayısı. Bugün henüz tutmadıysa seri dünden sayılır; pazar seriyi bozmaz. */
async function streakOf(uid: string, todayCalls: number) {
  let n = todayCalls >= DAILY_TARGET ? 1 : 0
  for (let i = 1; i <= 60; i++) {
    const c = await callsOn(uid, i)
    if (c >= DAILY_TARGET) { n++; continue }
    if (dayStart(i).getDay() === 0) continue
    break
  }
  return n
}

export default function Rivalry() {
  const [rows, setRows] = useState<Row[]>([])
  const [streaks, setStreaks] = useState<Record<string, number>>({})
  useEffect(() => {
    supabase.from('rivalry').select('*').then(async ({ data }) => {
      const r = (data ?? []) as Row[]
      setRows(r)
      const s = await Promise.all(r.map(async (x) => [x.id, await streakOf(x.id, x.today_calls)] as const))
      setStreaks(Object.fromEntries(s))
    })
  }, [])
  if (rows.length < 2) return null
  const topCalls = Math.max(...rows.map((r) => r.week_calls))
  const topToday = Math.max(...rows.map((r) => r.today_calls))
  return (
    <>
      <h2 className="section">Bugünkü hedef: {DAILY_TARGET} arama</h2>
      <div className="rivals">
        {rows.map((r) => {
          const pct = Math.min(100, (r.today_calls / DAILY_TARGET) * 100)
          const done = r.today_calls >= DAILY_TARGET
          const st = streaks[r.id]
          return (
            <div key={r.id} className={'rival' + (done ? ' hit' : '')}>
              <div className="rival-head">
                <span className="rival-name">{r.full_name.split(' ')[0]}</span>
                {r.today_calls > 0 && r.today_calls === topToday && <span title="Bugün önde">👑</span>}
                {st !== undefined && <span className="streak" title="Hedefi tutturduğu ardışık gün">🔥 {st}</span>}
              </div>
              <div className="goal-num"><b>{r.today_calls}</b> / {DAILY_TARGET}</div>
              <div className="progress"><div style={{ width: `${pct}%` }} /></div>
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                {done ? '✅ Hedef tamam' : `${DAILY_TARGET - r.today_calls} arama kaldı`}
              </div>
            </div>
          )
        })}
      </div>

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
