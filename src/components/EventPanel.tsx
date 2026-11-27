import { useState } from 'react'
import Panel, { fromLocalInput, toLocalInput } from './Panel'
import { supabase, type CalEvent } from '../lib/supabase'
import { useSession } from '../lib/session'

export default function EventPanel({ event, onClose, onSaved, onDeleted }: {
  event: CalEvent; onClose: () => void; onSaved: (e: CalEvent) => void; onDeleted: (id: string) => void
}) {
  const { me, people } = useSession()
  const isNew = !event.created_by
  const [e, setE] = useState<CalEvent>(event)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!e.title.trim()) return setErr('Başlık gir.')
    if (new Date(e.ends_at) <= new Date(e.starts_at)) return setErr('Bitiş, başlangıçtan sonra olmalı.')
    const row = { id: e.id, owner_id: e.owner_id, title: e.title.trim(), starts_at: e.starts_at, ends_at: e.ends_at, notes: e.notes || null, location: e.location || null }
    const { error } = isNew
      ? await supabase.from('events').insert({ ...row, created_by: me!.id })
      : await supabase.from('events').update(row).eq('id', e.id)
    if (error) return setErr(error.message)
    onSaved({ ...e, created_by: e.created_by ?? me!.id })
    onClose()
  }
  const remove = async () => {
    if (!confirm('Etkinlik silinsin mi?')) return
    await supabase.from('events').delete().eq('id', e.id)
    onDeleted(e.id)
    onClose()
  }
  const setStart = (v: string) => {
    const s = fromLocalInput(v); if (!s) return
    const dur = new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()
    setE({ ...e, starts_at: s, ends_at: new Date(new Date(s).getTime() + Math.max(dur, 15 * 60000)).toISOString() })
  }

  return (
    <Panel onClose={onClose} actions={!isNew ? <button className="btn ghost" onClick={remove}>Sil</button> : undefined}>
      <input className="title-input" autoFocus={isNew} placeholder="Başlık ekle" value={e.title} onChange={(x) => setE({ ...e, title: x.target.value })} />
      <div className="field"><label>Başlangıç</label>
        <input className="input" type="datetime-local" value={toLocalInput(e.starts_at)} onChange={(x) => setStart(x.target.value)} />
      </div>
      <div className="field"><label>Bitiş</label>
        <input className="input" type="datetime-local" value={toLocalInput(e.ends_at)} onChange={(x) => { const v = fromLocalInput(x.target.value); if (v) setE({ ...e, ends_at: v }) }} />
      </div>
      <div className="field"><label>Kimin takvimi</label>
        <div className="chips">
          {people.map((p) => <button key={p.id} className={'chip' + (e.owner_id === p.id ? ' on' : '')} onClick={() => setE({ ...e, owner_id: p.id })}>{p.full_name.split(' ')[0]}</button>)}
        </div>
      </div>
      <div className="field"><label>Yer</label>
        <input className="input" value={e.location ?? ''} onChange={(x) => setE({ ...e, location: x.target.value })} placeholder="İsteğe bağlı" />
      </div>
      <div className="field"><label>Not</label>
        <textarea className="input" value={e.notes ?? ''} onChange={(x) => setE({ ...e, notes: x.target.value })} />
      </div>
      {err && <div className="err">{err}</div>}
      <button className="btn primary big" style={{ width: '100%' }} onClick={save}>Kaydet</button>
    </Panel>
  )
}
