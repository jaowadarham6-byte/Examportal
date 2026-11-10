import { useEffect, useState } from 'react'
import { sb } from './supabase'
import Admin from './Admin'
import Student from './Student'

function Auth() {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', full_name: '', class_id: '' })
  const [classes, setClasses] = useState([])
  const [msg, setMsg] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  useEffect(() => {
    sb.from('classes').select('*').order('name').then(({ data }) => setClasses(data || []))
  }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const redirectTo = window.location.origin
  const switchTo = (m) => { setMode(m); setMsg(''); setUnconfirmed(false) }

  async function go(e) {
    e.preventDefault()
    setMsg(''); setUnconfirmed(false)
    if (mode === 'forgot') {
      const { error } = await sb.auth.resetPasswordForEmail(f.email, { redirectTo })
      return setMsg(error ? error.message : 'If this email has an account, a reset link has been sent. Check your inbox and spam folder.')
    }
    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password })
      if (error) { setMsg(error.message); setUnconfirmed(/confirm/i.test(error.message)) }
      return
    }
    const { error } = await sb.auth.signUp({
      email: f.email, password: f.password,
      options: { emailRedirectTo: redirectTo, data: { full_name: f.full_name, class_id: f.class_id } },
    })
    if (error) return setMsg(error.message)
    setMode('login')
    setMsg('Account created. We sent a confirmation link to your email. Open it (check the spam folder too), then log in here.')
  }
  const resend = async () => {
    const { error } = await sb.auth.resend({ type: 'signup', email: f.email, options: { emailRedirectTo: redirectTo } })
    setMsg(error ? error.message : 'Confirmation email sent again. Check your inbox and spam folder.')
  }
  const title = { login: 'Log in', signup: 'Create student account', forgot: 'Reset password' }[mode]
  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 48 }}>
      <h2>{title}</h2>
      <form className="card" onSubmit={go}>
        {mode === 'signup' && (
          <>
            <label>Full name</label>
            <input required value={f.full_name} onChange={set('full_name')} />
            <label>Class</label>
            <select required value={f.class_id} onChange={set('class_id')}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}
        <label>Email</label>
        <input type="email" required value={f.email} onChange={set('email')} />
        {mode !== 'forgot' && (
          <>
            <label>Password</label>
            <input type="password" minLength={6} required value={f.password} onChange={set('password')} />
          </>
        )}
        {msg && <p className="err" style={{ color: msg.startsWith('Account') || msg.startsWith('If') || msg.startsWith('Confirmation') ? 'var(--ok)' : undefined }}>{msg}</p>}
        {unconfirmed && <p><button type="button" className="ghost" onClick={resend}>Resend confirmation email</button></p>}
        <button>{{ login: 'Log in', signup: 'Create account', forgot: 'Send reset link' }[mode]}</button>
      </form>
      {mode === 'login' && (
        <>
          <button className="ghost" onClick={() => switchTo('signup')}>New student? Create account</button>{' '}
          <button className="ghost" onClick={() => switchTo('forgot')}>Forgot password?</button>
        </>
      )}
      {mode !== 'login' && <button className="ghost" onClick={() => switchTo('login')}>Back to log in</button>}
    </div>
  )
}

function NewPassword({ done }) {
  const [p, setP] = useState('')
  const [msg, setMsg] = useState('')
  const go = async (e) => {
    e.preventDefault()
    const { error } = await sb.auth.updateUser({ password: p })
    if (error) return setMsg(error.message)
    window.history.replaceState(null, '', window.location.pathname)
    done()
  }
  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 48 }}>
      <h2>Choose a new password</h2>
      <form className="card" onSubmit={go}>
        <label>New password</label>
        <input type="password" minLength={6} required value={p} onChange={(e) => setP(e.target.value)} />
        {msg && <p className="err">{msg}</p>}
        <button>Save password</button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [recovery, setRecovery] = useState(() => window.location.hash.includes('type=recovery'))
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return setProfile(null)
    sb.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setProfile(data))
  }, [session])

  if (session === undefined) return <p className="c">Loading...</p>
  if (!session) return <Auth />
  if (recovery) return <NewPassword done={() => setRecovery(false)} />
  if (!profile) return <p className="c">Loading...</p>
  return (
    <div className="wrap">
      <header>
        <b>Exam Portal</b>
        <span>
          {profile.full_name}{' '}
          <button className="ghost" onClick={() => sb.auth.signOut()}>Log out</button>
        </span>
      </header>
      {!profile.approved ? (
        <p className="card">Your account has been blocked. Please contact your teacher.</p>
      ) : profile.role === 'admin' ? (
        <Admin />
      ) : (
        <Student />
      )}
    </div>
  )
}
