// Çevrimdışı katman: veri okumaları telefonda saklanır, internet yokken oradan gelir.
// Yazmalar internet yokken sıraya girer ve internet gelince sırayla gönderilir.

const CACHE_KEY = 'pb-cache-v1'
const QUEUE_KEY = 'pb-queue-v1'
const MAX_ENTRIES = 250

interface Cached { status: number; headers: Record<string, string>; body: string; at: number }
interface Queued { url: string; method: string; headers: Record<string, string>; body: string | null; at: number }

const listeners = new Set<() => void>()
export const onQueueChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
const emit = () => listeners.forEach((f) => f())

const load = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* depolama dolu */ } }

export const queueLength = () => load<Queued[]>(QUEUE_KEY, []).length

const isData = (url: string) => url.includes('/rest/v1/')
const keyOf = (url: string, method: string, headers: Headers) => method + ' ' + url + ' ' + (headers.get('prefer') ?? '') + ' ' + (headers.get('range') ?? '')

function hdrs(h: HeadersInit | undefined): Headers { return new Headers(h ?? {}) }

let realFetch: typeof fetch = (...a) => fetch(...a)
let tokenGetter: () => Promise<string | null> = async () => null
export function configureOffline(getToken: () => Promise<string | null>) { tokenGetter = getToken }

export const offlineFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const headers = hdrs(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  if (!isData(url)) return realFetch(input, init)

  const isRead = method === 'GET' || method === 'HEAD' || (method === 'POST' && url.includes('/rest/v1/rpc/') && !url.includes('send_test'))

  if (isRead) {
    const key = keyOf(url, method, headers) + (method === 'POST' ? ' ' + String(init?.body ?? '') : '')
    try {
      const res = await realFetch(input, init)
      if (res.ok) {
        const body = method === 'HEAD' ? '' : await res.clone().text()
        const cache = load<Record<string, Cached>>(CACHE_KEY, {})
        const keep: Record<string, string> = {}
        res.headers.forEach((v, k) => { if (['content-range', 'content-type'].includes(k)) keep[k] = v })
        cache[key] = { status: res.status, headers: keep, body, at: Date.now() }
        const keys = Object.keys(cache)
        if (keys.length > MAX_ENTRIES) keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete cache[k])
        save(CACHE_KEY, cache)
      }
      return res
    } catch (e) {
      const hit = load<Record<string, Cached>>(CACHE_KEY, {})[key]
      if (hit) return new Response(method === 'HEAD' ? null : hit.body, { status: hit.status, headers: hit.headers })
      throw e
    }
  }

  // Yazma: önce sıradakileri gönder, internet yoksa sıraya al
  const body = typeof init?.body === 'string' ? init.body : null
  if (!navigator.onLine) return enqueue(url, method, headers, body)
  try {
    await flushQueue()
    return await realFetch(input, init)
  } catch {
    return enqueue(url, method, headers, body)
  }
}

function enqueue(url: string, method: string, headers: Headers, body: string | null) {
  const q = load<Queued[]>(QUEUE_KEY, [])
  const h: Record<string, string> = {}
  headers.forEach((v, k) => { if (k !== 'authorization') h[k] = v })
  q.push({ url, method, headers: h, body, at: Date.now() })
  save(QUEUE_KEY, q)
  emit()
  return new Response(null, { status: 201, statusText: 'Queued' })
}

let flushing = false
export async function flushQueue() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    let q = load<Queued[]>(QUEUE_KEY, [])
    while (q.length) {
      const item = q[0]
      const token = await tokenGetter()
      const res = await realFetch(item.url, {
        method: item.method,
        headers: { ...item.headers, ...(token ? { authorization: 'Bearer ' + token } : {}) },
        body: item.body,
      })
      // Kalıcı hata (ör. çift kayıt) sırayı tıkamasın
      if (!res.ok && res.status >= 500) break
      q = load<Queued[]>(QUEUE_KEY, []).slice(1)
      save(QUEUE_KEY, q)
      emit()
    }
  } catch { /* internet yine gitti */ } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
  setInterval(() => { if (queueLength()) flushQueue() }, 30000)
}
