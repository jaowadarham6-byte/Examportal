import { useEffect, useState } from 'react'
import { sb } from './supabase'
import Admin from './Admin'
import Student from './Student'

function Auth() {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', full_name: '', class_id: '' })
  const [classes, setClasses] = useState([])
  const [msg, setMsg] = useState('')
  useEffect(() => {
    sb.from('classes').select('*').order('name').then(({ data }) => setClasses(data || []))
  }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function go(e) {
    e.preventDefault()
    setMsg('')
    const { error } =
      mode === 'login'
        ? await sb.auth.signInWithPassword({ email: f.email, password: f.password })
        : await sb.auth.signUp({
            email: f.email,
            password: f.password,
            options: { data: { full_name: f.full_name, class_id: f.class_id } },
          })
    if (error) setMsg(error.message)
    else if (mode === 'signup') setMsg('Account created. You can log in after the teacher approves it.')
  }
  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 48 }}>
      <h2>{mode === 'login' ? 'Log in' : 'Create student account'}</h2>
      <form className="card" onSubmit={go}>
        {mode === 'signup' && (
          <>
            <label>Full name</label>
            <input required value={f.full_name} onChange={set('full_name')} />
            <label>Class</label>
            <select required value={f.class_id} onChange={set('class_id')}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        <label>Email</label>
        <input type="email" required value={f.email} onChange={set('email')} />
        <label>Password</label>
        <input type="password" minLength={6} required value={f.password} onChange={set('password')} />
        {msg && <p className="err">{msg}</p>}
        <button>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <button className="ghost" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }}>
        {mode === 'login' ? 'New student? Create account' : 'Have an account? Log in'}
      </button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return setProfile(null)
    sb.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setProfile(data))
  }, [session])

  if (session === undefined) return <p className="c">Loading...</p>
  if (!session) return <Auth />
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
        <p className="card">Your account is waiting for the teacher's approval. Check back later.</p>
      ) : profile.role === 'admin' ? (
        <Admin />
      ) : (
        <Student />
      )}
    </div>
  )
}
