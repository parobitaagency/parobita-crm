import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fmtTime, supabase, type CalEvent, type Meeting } from '../lib/supabase'
import { useSession } from '../lib/session'
import EventPanel from './EventPanel'

const SEL = '*, leads(business_name, phone, address, district, maps_url)'
const DAY = 86400000
const HOUR_PX = 52
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; return new Date(x.getTime() - wd * DAY) }
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
export const calRange = () => ({
  from: new Date(startOfWeek(new Date()).getTime() - 35 * DAY).toISOString().slice(0, 10),
  to: new Date(Date.now() + 90 * DAY).toISOString().slice(0, 10),
})

interface Item { key: string; start: Date; end: Date; title: string; sub?: string; tone: string; faded?: boolean; warn?: boolean; kind: 'meeting' | 'event'; ref: Meeting | CalEvent }

// Çakışan kutuları yan yana yerleştir
function layout(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime())
  const out: (Item & { col: number; cols: number })[] = []
  let group: (Item & { col: number; cols: number })[] = []
  let groupEnd = 0
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.col + 1)); group.forEach((g) => (g.cols = n)); out.push(...group); group = [] }
  for (const it of sorted) {
    if (group.length && it.start.getTime() >= groupEnd) flush()
    const used = new Set(group.filter((g) => g.end.getTime() > it.start.getTime()).map((g) => g.col))
    let col = 0; while (used.has(col)) col++
    group.push({ ...it, col, cols: 1 })
    groupEnd = Math.max(groupEnd, it.end.getTime())
  }
  if (group.length) flush()
  return out
}

export default function CalendarView({ onOpen }: { onOpen: (m: Meeting) => void }) {
  const { me, people } = useSession()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const [now, setNow] = useState(new Date())
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { from, to } = calRange()
    supabase.from('meetings').select(SEL).neq('status', 'iptal').gte('scheduled_at', from).lte('scheduled_at', to).order('scheduled_at')
      .then(({ data }) => setMeetings((data ?? []) as Meeting[]))
    supabase.from('events').select('*').gte('starts_at', from).lte('starts_at', to).order('starts_at')
      .then(({ data }) => setEvents((data ?? []) as CalEvent[]))
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useLayoutEffect(() => { scroller.current?.scrollTo({ top: HOUR_PX * 8 - 8 }) }, [])

  const toneOf = (uid: string | null) => { const i = people.findIndex((p) => p.id === uid); return i === 0 ? 'blue' : i === 1 ? 'purple' : 'gray' }
  const all: Item[] = useMemo(() => [
    ...meetings.filter((m) => m.scheduled_at).map((m) => {
      const s = new Date(m.scheduled_at!)
      return { key: 'm' + m.id, start: s, end: new Date(s.getTime() + m.duration_min * 60000), title: m.leads?.business_name ?? 'Toplantı',
        sub: m.contact_name ?? undefined, tone: toneOf(m.created_by), faded: m.status !== 'planli', warn: m.status === 'planli' && !(m.contact_name ?? '').trim(), kind: 'meeting' as const, ref: m }
    }),
    ...events.map((e) => ({ key: 'e' + e.id, start: new Date(e.starts_at), end: new Date(e.ends_at), title: e.title, sub: e.location ?? undefined,
      tone: toneOf(e.owner_id) + ' soft', kind: 'event' as const, ref: e })),
  ], [meetings, events, people]) // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * DAY)), [week])
  const of = (d: Date) => layout(all.filter((it) => sameDay(it.start, d)))

  const newAt = (d: Date, hour: number) => {
    const s = new Date(d); s.setHours(hour, 0, 0, 0)
    setEdit({ id: crypto.randomUUID(), owner_id: me!.id, created_by: null, title: '', starts_at: s.toISOString(), ends_at: new Date(s.getTime() + 3600000).toISOString(), notes: null, location: null })
  }
  const open = (it: Item) => it.kind === 'meeting' ? onOpen(it.ref as Meeting) : setEdit(it.ref as CalEvent)
  const goWeek = (w: Date) => { setWeek(w); setDay(w) }

  const Column = ({ d }: { d: Date }) => (
    <div className={'tg-col' + (sameDay(d, now) ? ' today' : '')}>
      {Array.from({ length: 24 }, (_, h) => <div key={h} className="tg-slot" onClick={() => newAt(d, h)} />)}
      {of(d).map((it) => {
        const top = (it.start.getHours() + it.start.getMinutes() / 60) * HOUR_PX
        const h = Math.max(22, ((it.end.getTime() - it.start.getTime()) / 3600000) * HOUR_PX - 2)
        return (
          <div key={it.key} className={'tg-ev ' + it.tone + (it.faded ? ' done' : '')}
            style={{ top, height: h, left: `calc(${(it.col / it.cols) * 100}% + 2px)`, width: `calc(${100 / it.cols}% - 4px)` }}
            onClick={(e) => { e.stopPropagation(); open(it) }}>
            <div className="tg-ev-n">{it.warn ? '⚠️ ' : ''}{it.title}</div>
            {h > 34 && <div className="tg-ev-t">{fmtTime(it.start.toISOString())} – {fmtTime(it.end.toISOString())}</div>}
            {h > 50 && it.sub && <div className="tg-ev-t">{it.sub}</div>}
          </div>
        )
      })}
      {sameDay(d, now) && <div className="tg-now" style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR_PX }} />}
    </div>
  )

  return (
    <div>
      <div className="cal-nav">
        <button className="btn" onClick={() => { const t = new Date(); t.setHours(0, 0, 0, 0); setWeek(startOfWeek(t)); setDay(t) }}>Bugün</button>
        <button className="icon-btn" onClick={() => goWeek(new Date(week.getTime() - 7 * DAY))}>‹</button>
        <button className="icon-btn" onClick={() => goWeek(new Date(week.getTime() + 7 * DAY))}>›</button>
        <span className="cal-title">{week.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</span>
        <span className="spacer" />
        <span className="cal-legend desktop-only">{people.slice(0, 2).map((p, i) => <span key={p.id} className={'tag ' + (i === 0 ? 'blue' : 'purple')}>{p.full_name.split(' ')[0]}</span>)}</span>
        <button className="btn primary" onClick={() => newAt(day, Math.min(23, new Date().getHours() + 1))}>+ Yeni</button>
      </div>

      <div className="mobile-only">
        <div className="cal-strip">
          {days.map((d) => (
            <button key={d.toISOString()} className={'cal-day' + (sameDay(d, day) ? ' on' : '') + (sameDay(d, now) ? ' today' : '')} onClick={() => setDay(d)}>
              <span>{d.toLocaleDateString('tr-TR', { weekday: 'narrow' })}</span>
              <b>{d.getDate()}</b>
              {all.some((it) => sameDay(it.start, d)) && <i />}
            </button>
          ))}
        </div>
      </div>

      <div className="tg">
        <div className="tg-header desktop-only">
          <div className="tg-gutter" />
          {days.map((d) => (
            <div key={d.toISOString()} className={'tg-dh' + (sameDay(d, now) ? ' today' : '')}>
              <span>{d.toLocaleDateString('tr-TR', { weekday: 'short' }).toUpperCase()}</span>
              <b>{d.getDate()}</b>
            </div>
          ))}
        </div>
        <div className="tg-body" ref={scroller}>
          <div className="tg-gutter">
            {Array.from({ length: 24 }, (_, h) => <div key={h} className="tg-hour">{h === 0 ? '' : String(h).padStart(2, '0') + ':00'}</div>)}
          </div>
          <div className="tg-cols desktop-only">{days.map((d) => <Column key={d.toISOString()} d={d} />)}</div>
          <div className="tg-cols mobile-only-flex"><Column d={day} /></div>
        </div>
      </div>

      {edit && (
        <EventPanel event={edit} onClose={() => setEdit(null)}
          onSaved={(e) => setEvents((xs) => [...xs.filter((x) => x.id !== e.id), e])}
          onDeleted={(id) => setEvents((xs) => xs.filter((x) => x.id !== id))} />
      )}
    </div>
  )
}
