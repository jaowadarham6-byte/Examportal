import { useEffect, useRef, useState } from 'react'
import { sb } from './supabase'
import Rich from './Rich'

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function Take({ exam, done, back }) {
  const [d, setD] = useState(null)
  const [ans, setAns] = useState({})
  const [flag, setFlag] = useState({})
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(0)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState('')
  const [warnOff, setWarnOff] = useState(false)
  const sent = useRef(false)
  const dirty = useRef(false)

  useEffect(() => {
    sb.rpc('start_exam', { p_exam_id: exam.id }).then(({ data, error }) => {
      if (error) return setErr(error.message)
      setD(data); setLeft(data.remaining); setAns(data.answers || {})
    })
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [idx])

  // autosave 1.5 seconds after the last change
  useEffect(() => {
    if (!d || !dirty.current) return
    const t = setTimeout(async () => {
      const { error } = await sb.rpc('save_answers', { p_attempt_id: d.attempt_id, p_answers: ans })
      if (error) setSaved('Not saved yet. Check your internet.')
      else { dirty.current = false; setSaved('Answers saved') }
    }, 1500)
    return () => clearTimeout(t)
  }, [ans, d])

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
  const qs = d.questions
  if (!qs.length) return <div><p className="card">This exam has no questions.</p><button onClick={back}>Back</button></div>
  const q = qs[idx]
  const answered = qs.filter((x) => ans[x.id] !== undefined).length
  const flagged = qs.filter((x) => flag[x.id]).length
  const low = left <= 300 && d.duration_min >= 10

  const pick = (qid, j) => { dirty.current = true; setAns({ ...ans, [qid]: j }) }
  const clear = (qid) => { dirty.current = true; const n = { ...ans }; delete n[qid]; setAns(n) }
  const confirmSubmit = () => {
    const un = qs.length - answered
    const msg = [
      un ? `${un} question(s) are still unanswered.` : 'All questions are answered.',
      flagged ? `${flagged} question(s) are marked for review.` : '',
      'Submit now? You cannot change your answers afterwards.',
    ].filter(Boolean).join('\n')
    if (window.confirm(msg)) submit()
  }

  return (
    <div>
      <div className={'timer' + (low ? ' low' : '')}>
        Answered {answered}/{qs.length} &nbsp;|&nbsp; Time left: {mmss(left)} {saved && <small>&nbsp;({saved})</small>}
      </div>
      {low && !warnOff && left > 0 && (
        <div className="card warn">
          5 minutes or less left. Check your answers and submit. <button className="ghost" onClick={() => setWarnOff(true)}>OK</button>
        </div>
      )}
      <h2>{exam.title}{d.practice && <small> (practice, not counted)</small>}</h2>

      <details className="card">
        <summary>Question list ({answered} answered, {flagged} marked for review)</summary>
        <div className="qgrid">
          {qs.map((x, i) => (
            <button key={x.id} type="button" onClick={() => setIdx(i)}
              className={['qb', ans[x.id] !== undefined ? 'done' : '', flag[x.id] ? 'flag' : '', i === idx ? 'cur' : ''].join(' ')}>
              {i + 1}
            </button>
          ))}
        </div>
        <small>Filled = answered. Orange = marked for review. White = not answered yet.</small>
      </details>

      {q.stimulus && (
        <div className="card stim">
          <small>Stimulus</small>
          <p style={{ margin: '4px 0' }}><Rich text={q.stimulus} /></p>
          {q.stimulus_image && <img src={q.stimulus_image} alt="Stimulus figure" style={{ maxWidth: '100%', borderRadius: 6 }} />}
        </div>
      )}
      <div className="card">
        <p><b>{idx + 1} / {qs.length}.</b> <Rich text={q.body} /> <small>({q.marks} mark)</small></p>
        {q.image_url && <img src={q.image_url} alt="Question figure" style={{ maxWidth: '100%', borderRadius: 6 }} />}
        {q.options.map((o, j) => (
          <label className="opt" key={j}>
            <input type="radio" name={'q' + q.id} checked={ans[q.id] === j} onChange={() => pick(q.id, j)} />
            <span><Rich text={o} /></span>
          </label>
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="ghost" onClick={() => setFlag({ ...flag, [q.id]: !flag[q.id] })}>
            {flag[q.id] ? 'Remove review mark' : 'Mark for review'}
          </button>
          {ans[q.id] !== undefined && <button type="button" className="ghost" onClick={() => clear(q.id)}>Clear answer</button>}
        </div>
      </div>

      <div className="row">
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
        <button disabled={idx === qs.length - 1} onClick={() => setIdx(idx + 1)}>Next</button>
      </div>
      <br />
      <button className="danger" onClick={confirmSubmit}>Submit exam</button>
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
      {(r.items || []).map((q, i, arr) => (
        <div className="card" key={q.id}>
          {q.stimulus && (i === 0 || arr[i - 1].stimulus !== q.stimulus) && (
            <div className="card stim">
              <small>Stimulus</small>
              <p style={{ margin: '4px 0' }}><Rich text={q.stimulus} /></p>
              {q.stimulus_image && <img src={q.stimulus_image} alt="Stimulus figure" style={{ maxWidth: '100%', borderRadius: 6 }} />}
            </div>
          )}
          <p><b>{i + 1}.</b> <Rich text={q.body} /></p>
          {q.image_url && <img src={q.image_url} alt="Question figure" style={{ maxWidth: '100%', borderRadius: 6 }} />}
          {q.options.map((o, j) => (
            <div key={j} className={j === q.correct ? 'ok' : j === q.chosen ? 'bad' : 'plain'}>
              <Rich text={o} />{j === q.chosen ? ' (your answer)' : ''}{j === q.correct ? ' (correct)' : ''}
            </div>
          ))}
          {q.chosen === null && <p className="err">Not answered</p>}
          {q.explanation && <div className="ex"><Rich text={q.explanation} /></div>}
        </div>
      ))}
    </div>
  )
}

const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

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

  const graded = attempts.filter((a) => !a.practice)
  const done = Object.fromEntries(graded.filter((a) => a.submitted_at).map((a) => [a.exam_id, a]))
  const finished = graded.filter((a) => a.submitted_at)
  const now = Date.now()

  return (
    <div>
      <nav>
        {['exams', 'resources', 'progress'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === 'exams' && (exams.length === 0 ? <p className="card">No exams available yet.</p> : exams.map((e) => {
        const opens = e.opens_at ? new Date(e.opens_at).getTime() : null
        const closes = e.closes_at ? new Date(e.closes_at).getTime() : null
        const mine = done[e.id]
        const going = attempts.some((a) => a.exam_id === e.id && !a.submitted_at &&
          (!e.practice || new Date(a.started_at).getTime() + e.duration_min * 60000 > now))
        const start = () => {
          const m = e.practice ? 'Start practice? It does not count toward your results.' : 'Start now? The timer begins immediately and you get one attempt.'
          if (window.confirm(m)) setView({ type: 'take', exam: e })
        }
        let action
        if (!e.practice && mine) action = (
          <span>{mine.score}/{mine.total}{' '}<button className="ghost" onClick={() => setView({ type: 'result', id: mine.id })}>View result</button></span>
        )
        else if (going) action = <button onClick={() => setView({ type: 'take', exam: e })}>Continue</button>
        else if (opens && opens > now) action = <small>Opens {fmt(e.opens_at)}</small>
        else if (closes && closes < now) action = <small>Closed</small>
        else action = <button onClick={start}>{e.practice ? 'Practice' : 'Start'}</button>
        return (
          <div className="card row" key={e.id}>
            <div>
              <b>{e.title}</b>{e.practice && <small> (practice)</small>}<br />
              <small>
                {e.duration_min} min{Number(e.negative_mark) > 0 ? `, negative marking ${e.negative_mark}` : ''}
                {e.opens_at ? `, opens ${fmt(e.opens_at)}` : ''}{e.closes_at ? `, start before ${fmt(e.closes_at)}` : ''}
              </small>
            </div>
            {action}
          </div>
        )
      }))}

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
