import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './supabase'

interface Ctx {
  session: Session | null
  me: Profile | null
  people: Profile[]
  badges: { missing: number; awaiting: number }
  marathon: { done: number; target: number } | null
  refreshBadges: () => void
  loading: boolean
}

const SessionCtx = createContext<Ctx>({} as Ctx)
export const useSession = () => useContext(SessionCtx)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Profile | null>(null)
  const [people, setPeople] = useState<Profile[]>([])
  const [badges, setBadges] = useState({ missing: 0, awaiting: 0 })
  const [loading, setLoading] = useState(true)
  const [marathon, setMarathon] = useState<{ done: number; target: number } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    }).catch(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshBadges = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser()
    const [a, b, m] = await Promise.all([
      supabase.from('meetings_missing').select('id', { count: 'exact', head: true }),
      supabase.from('meetings_awaiting_result').select('id', { count: 'exact', head: true }),
      supabase.from('marathons').select('done, target').eq('user_id', u.user?.id ?? '').is('finished_at', null).maybeSingle(),
    ])
    setBadges({ missing: a.count ?? 0, awaiting: b.count ?? 0 })
    setMarathon((m.data as { done: number; target: number } | null) ?? null)
  }, [])

  useEffect(() => {
    if (!session) { setMe(null); return }
    ;(async () => {
      try {
      const { data } = await supabase.from('profiles').select('id, full_name, role').order('full_name')
      const list = (data ?? []) as Profile[]
      setPeople(list)
      setMe(list.find((p) => p.id === session.user.id) ?? null)
      await refreshBadges()
      } finally { setLoading(false) }
    })()
  }, [session, refreshBadges])

  useEffect(() => {
    const onFocus = () => session && refreshBadges()
    const onVis = () => document.visibilityState === 'visible' && onFocus()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis) }
  }, [session, refreshBadges])

  return (
    <SessionCtx.Provider value={{ session, me, people, badges, marathon, refreshBadges, loading }}>
      {children}
    </SessionCtx.Provider>
  )
}
