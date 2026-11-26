import { Component, type ReactNode } from 'react'

export async function hardReload() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
    const keys = await caches?.keys?.()
    await Promise.all((keys ?? []).map((k) => caches.delete(k)))
  } catch { /* yoksay */ }
  location.reload()
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.message ?? e) } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="login"><div className="box">
        <h1>Bir şeyler ters gitti</h1>
        <p className="muted" style={{ wordBreak: 'break-word' }}>{this.state.err}</p>
        <button className="btn primary big" style={{ width: '100%' }} onClick={hardReload}>Önbelleği temizle ve yenile</button>
      </div></div>
    )
  }
}
