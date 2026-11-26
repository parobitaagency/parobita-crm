import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr('E-posta ya da şifre hatalı.')
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <span className="ws-icon" style={{ width: 36, height: 36, fontSize: 18, borderRadius: 8 }}>P</span>
        <h1>Parobita</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>Hesabınla giriş yap.</p>
        <div className="field"><label>E-posta</label>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field"><label>Şifre</label>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn primary big" style={{ width: '100%' }} disabled={busy}>Giriş yap</button>
      </form>
    </div>
  )
}
