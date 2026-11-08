import { useEffect, useRef, useState } from 'react'
import { sb } from './supabase'

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function Take({ exam, done, back }) {
  const [d, setD] = useState(null)
  const [ans, setAns] = useState({})
  const [left, setLeft] = useState(0)
  const [err, setErr] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    sb.rpc('start_exam', { p_exam_id: exam.id }).then(({ data, error }) => {
      if (error) return setErr(error.message)
      setD(data)
      setLeft(data.remaining)
    })
  }, [])

  const submit = async () => {
    if (sent.current) return
    sent.current = true
    const { error } = await sb.rpc('submit_exam', { p_attempt_id: d.attempt_id, p_answers: ans })
    if (error) { sent.current = false; return setErr(error.message) }
    done(d.attempt_id)
  }

  useEffect(() => {
    if (!d) return
    if (left <= 0) { submit(); return }
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [d, left])

  if (err) return <div><p className="err">{err}</p><button onClick={back}>Back</button></div>
  if (!d) return <p className="c">Loading exam...</p>
  return (
    <div>
      <div className="timer">Time left: {mmss(left)}</div>
      <h2>{exam.title}</h2>
      {d.questions.map((q, i) => (
        <div className="card" key={q.id}>
          <p style={{ whiteSpace: 'pre-wrap' }}><b>{i + 1}.</b> {q.body} <small>({q.marks} mark)</small></p>
          {q.options.map((o, j) => (
            <label className="opt" key={j}>
              <input type="radio" name={'q' + q.id} checked={ans[q.id] === j} onChange={() => setAns({ ...ans, [q.id]: j })} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      ))}
      <button onClick={() => window.confirm('Submit your exam now? You cannot retake it.') && submit()}>Submit exam</button>
    </div>
  )
}

function Result({ id, back }) {
  const [r, setR] = useState(null)
  useEffect(() => { sb.rpc('get_result', { p_attempt_id: id }).then(({ data }) => setR(data)) }, [])
  if (!r) return <p className="c">Loading result...</p>
  return (
    <div>
      <button className="ghost" onClick={back}>Back</button>
      <h2>{r.title}</h2>
      <h3>Score: {r.score} / {r.total}</h3>
      {(r.items || []).map((q, i) => (
        <div className="card" key={q.id}>
          <p style={{ whiteSpace: 'pre-wrap' }}><b>{i + 1}.</b> {q.body}</p>
          {q.options.map((o, j) => (
            <div key={j} className={j === q.correct ? 'ok' : j === q.chosen ? 'bad' : 'plain'}>
              {o}{j === q.chosen ? ' (your answer)' : ''}{j === q.correct ? ' (correct)' : ''}
            </div>
          ))}
          {q.chosen === null && <p className="err">Not answered</p>}
          {q.explanation && <div className="ex" style={{ whiteSpace: 'pre-wrap' }}>{q.explanation}</div>}
        </div>
      ))}
    </div>
  )
}

export default function Student() {
  const [tab, setTab] = useState('exams')
  const [exams, setExams] = useState([])
  const [attempts, setAttempts] = useState([])
  const [view, setView] = useState(null)
  const [res, setRes] = useState([])

  useEffect(() => {
    if (view) return
    ;(async () => {
      setExams((await sb.from('exams').select('*').order('id', { ascending: false })).data || [])
      setAttempts((await sb.from('attempts').select('*, exams(title)').order('id')).data || [])
      setRes((await sb.from('resources').select('*').order('id', { ascending: false })).data || [])
    })()
  }, [view])

  if (view?.type === 'take') return <Take exam={view.exam} done={(id) => setView({ type: 'result', id })} back={() => setView(null)} />
  if (view?.type === 'result') return <Result id={view.id} back={() => setView(null)} />

  const done = Object.fromEntries(attempts.filter((a) => a.submitted_at).map((a) => [a.exam_id, a]))
  const finished = attempts.filter((a) => a.submitted_at)
  return (
    <div>
      <nav>
        {['exams', 'resources', 'progress'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'exams' && (exams.length === 0 ? <p className="card">No exams available yet.</p> : exams.map((e) => (
        <div className="card row" key={e.id}>
          <div>
            <b>{e.title}</b><br />
            <small>{e.duration_min} min{Number(e.negative_mark) > 0 ? `, negative marking ${e.negative_mark}` : ''}</small>
          </div>
          {done[e.id] ? (
            <span>
              {done[e.id].score}/{done[e.id].total}{' '}
              <button className="ghost" onClick={() => setView({ type: 'result', id: done[e.id].id })}>View result</button>
            </span>
          ) : (
            <button onClick={() => window.confirm('Start now? The timer begins immediately and you get one attempt.') && setView({ type: 'take', exam: e })}>Start</button>
          )}
        </div>
      )))}
      {tab === 'resources' && (res.length === 0 ? <p className="card">No links have been shared yet.</p> : res.map((r) => (
        <div className="card" key={r.id}>
          <a href={r.url} target="_blank" rel="noopener noreferrer"><b>{r.title}</b></a>
          {r.note && <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{r.note}</p>}
        </div>
      )))}
      {tab === 'progress' && (finished.length === 0 ? <p className="card">Your results will appear here after your first exam.</p> : finished.map((a) => {
        const pct = a.total > 0 ? Math.max(0, Math.round((a.score / a.total) * 100)) : 0
        return (
          <div className="card" key={a.id}>
            <div className="row"><b>{a.exams?.title}</b><span>{a.score}/{a.total} ({pct}%)</span></div>
            <div className="bar"><i style={{ width: pct + '%' }} /></div>
          </div>
        )
      }))}
    </div>
  )
}
