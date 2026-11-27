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
    const stored = (): Session | null => {
      // İnternetsizken süresi dolmuş oturum yenilenemez; kayıtlı oturumla devam et
      try { return JSON.parse(localStorage.getItem('sb-lzxkowlecpiwvbwrjqxs-auth-token') ?? 'null') as Session | null } catch { return null }
    }
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? (!navigator.onLine ? stored() : null)
      setSession(s)
      if (!s) setLoading(false)
    }).catch(() => {
      const s = stored()
      setSession(s)
      if (!s) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (!s && e !== 'SIGNED_OUT' && !navigator.onLine) return
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshBadges = useCallback(async () => {
    try {
    const { data: u } = await supabase.auth.getSession().then((r) => ({ data: { user: r.data.session?.user } }))
    const [a, b, m] = await Promise.all([
      supabase.from('meetings_missing').select('id', { count: 'exact', head: true }),
      supabase.from('meetings_awaiting_result').select('id', { count: 'exact', head: true }),
      supabase.from('marathons').select('done, target').eq('user_id', u.user?.id ?? '').is('finished_at', null).maybeSingle(),
    ])
    setBadges({ missing: a.count ?? 0, awaiting: b.count ?? 0 })
    setMarathon((m.data as { done: number; target: number } | null) ?? null)
    } catch { /* çevrimdışı */ }
  }, [])

  useEffect(() => {
    if (!session) { setMe(null); return }
    ;(async () => {
      try {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role').order('full_name')
      let list = (data ?? []) as Profile[]
      // İnternet yoksa en son kaydedilen kullanıcı bilgisini kullan
      if (error || !list.length) {
        try { list = JSON.parse(localStorage.getItem('pb-people') ?? '[]') as Profile[] } catch { list = [] }
      } else {
        try { localStorage.setItem('pb-people', JSON.stringify(list)) } catch { /* yoksay */ }
      }
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
