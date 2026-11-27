import { useEffect, useMemo, useState } from 'react'
import { fmtTime, supabase, type Meeting } from '../lib/supabase'
import { useSession } from '../lib/session'

const SEL = '*, leads(business_name, phone, address, district, maps_url)'
const DAY = 86400000
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; return new Date(x.getTime() - wd * DAY) }
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

// Tek sorgu: geçmiş 30 gün + gelecek 90 gün. Önbelleğe girer, çevrimdışı da görünür.
export default function CalendarView({ onOpen }: { onOpen: (m: Meeting) => void }) {
  const { people } = useSession()
  const [items, setItems] = useState<Meeting[]>([])
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })

  useEffect(() => {
    const from = new Date(startOfWeek(new Date()).getTime() - 35 * DAY).toISOString().slice(0, 10)
    const to = new Date(Date.now() + 90 * DAY).toISOString().slice(0, 10)
    supabase.from('meetings').select(SEL).neq('status', 'iptal').gte('scheduled_at', from).lte('scheduled_at', to).order('scheduled_at')
      .then(({ data }) => setItems((data ?? []) as Meeting[]))
  }, [])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * DAY)), [week])
  const color = (m: Meeting) => {
    const idx = people.findIndex((p) => p.id === m.created_by)
    return idx === 0 ? 'blue' : idx === 1 ? 'purple' : 'gray'
  }
  const of = (d: Date) => items.filter((m) => m.scheduled_at && sameDay(new Date(m.scheduled_at), d))
  const today = new Date()

  const Event = ({ m }: { m: Meeting }) => {
    const missing = !(m.contact_name ?? '').trim()
    return (
      <div className={'cal-ev ' + color(m) + (m.status !== 'planli' ? ' done' : '')} onClick={() => onOpen(m)}>
        <div className="cal-ev-t">{fmtTime(m.scheduled_at)}{missing && m.status === 'planli' ? ' ⚠️' : ''}</div>
        <div className="cal-ev-n">{m.leads?.business_name}</div>
        {m.contact_name && <div className="cal-ev-s">{m.contact_name}</div>}
      </div>
    )
  }

  return (
    <div>
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => { const w = new Date(week.getTime() - 7 * DAY); setWeek(w); setDay(w) }}>‹</button>
        <span className="cal-title">{week.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – {new Date(week.getTime() + 6 * DAY).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>
        <button className="icon-btn" onClick={() => { const w = new Date(week.getTime() + 7 * DAY); setWeek(w); setDay(w) }}>›</button>
        <span className="spacer" />
        <button className="btn ghost" onClick={() => { const t = new Date(); t.setHours(0, 0, 0, 0); setWeek(startOfWeek(t)); setDay(t) }}>Bugün</button>
        <span className="cal-legend">{people.slice(0, 2).map((p, i) => <span key={p.id} className={'tag ' + (i === 0 ? 'blue' : 'purple')}>{p.full_name.split(' ')[0]}</span>)}</span>
      </div>

      <div className="cal-week desktop-only">
        {days.map((d) => (
          <div key={d.toISOString()} className={'cal-col' + (sameDay(d, today) ? ' today' : '')}>
            <div className="cal-head"><span>{d.toLocaleDateString('tr-TR', { weekday: 'short' })}</span><b>{d.getDate()}</b></div>
            {of(d).map((m) => <Event key={m.id} m={m} />)}
          </div>
        ))}
      </div>

      <div className="mobile-only">
        <div className="cal-strip">
          {days.map((d) => (
            <button key={d.toISOString()} className={'cal-day' + (sameDay(d, day) ? ' on' : '') + (sameDay(d, today) ? ' today' : '')} onClick={() => setDay(d)}>
              <span>{d.toLocaleDateString('tr-TR', { weekday: 'narrow' })}</span>
              <b>{d.getDate()}</b>
              {of(d).length > 0 && <i />}
            </button>
          ))}
        </div>
        <div className="cal-daylist">
          {of(day).length ? of(day).map((m) => <Event key={m.id} m={m} />) : <div className="empty">Bu gün toplantı yok.</div>}
        </div>
      </div>
    </div>
  )
}
