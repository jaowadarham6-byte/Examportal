import { useEffect, useState } from 'react'
import { sb } from './supabase'
import Import from './Import'

function Students() {
  const [rows, setRows] = useState([])
  const [cls, setCls] = useState([])
  const [name, setName] = useState('')
  const load = async () => {
    setRows((await sb.from('profiles').select('*, classes(name)').eq('role', 'student').order('approved')).data || [])
    setCls((await sb.from('classes').select('*').order('name')).data || [])
  }
  useEffect(() => { load() }, [])
  const approve = async (id, v) => { await sb.from('profiles').update({ approved: v }).eq('id', id); load() }
  const addClass = async () => {
    if (!name.trim()) return
    const { error } = await sb.from('classes').insert({ name: name.trim() })
    if (error) alert(error.message)
    setName(''); load()
  }
  return (
    <div>
      <div className="card">
        <label>Add a class (students pick it when signing up)</label>
        <div className="row"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HSC 2027" style={{ flex: 1 }} /><button onClick={addClass}>Add class</button></div>
        <small>Classes: {cls.map((c) => c.name).join(', ') || 'none yet'}</small>
      </div>
      {rows.map((r) => (
        <div className="card row" key={r.id}>
          <span><b>{r.full_name}</b> <small>{r.classes?.name || 'no class'}</small></span>
          {r.approved
            ? <button className="ghost" onClick={() => approve(r.id, false)}>Block</button>
            : <button onClick={() => approve(r.id, true)}>Approve</button>}
        </div>
      ))}
    </div>
  )
}

function Questions() {
  const blank = { body: '', o: ['', '', '', ''], correct: 0, explanation: '', marks: 1 }
  const [f, setF] = useState(blank)
  const [list, setList] = useState([])
  const load = async () => setList((await sb.from('questions').select('*').order('id', { ascending: false })).data || [])
  useEffect(() => { load() }, [])
  const save = async (e) => {
    e.preventDefault()
    const options = f.o.map((x) => x.trim()).filter(Boolean)
    if (options.length < 2) return alert('Enter at least 2 options, filled in order.')
    if (+f.correct >= options.length) return alert('Correct option is empty.')
    const { error } = await sb.from('questions').insert({ body: f.body, options, correct: +f.correct, explanation: f.explanation, marks: +f.marks })
    if (error) return alert(error.message)
    setF(blank); load()
  }
  const del = async (id) => {
    if (!window.confirm('Delete this question?')) return
    const { error } = await sb.from('questions').delete().eq('id', id)
    if (error) alert(error.message)
    load()
  }
  return (
    <div>
      <form className="card" onSubmit={save}>
        <label>Question (Bengali or English)</label>
        <textarea required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        {f.o.map((v, i) => (
          <div key={i}>
            <label>Option {'ABCD'[i]}</label>
            <input value={v} onChange={(e) => { const o = [...f.o]; o[i] = e.target.value; setF({ ...f, o }) }} />
          </div>
        ))}
        <label>Correct option</label>
        <select value={f.correct} onChange={(e) => setF({ ...f, correct: e.target.value })}>
          {[0, 1, 2, 3].map((i) => <option key={i} value={i}>{'ABCD'[i]}</option>)}
        </select>
        <label>Marks</label>
        <input type="number" step="0.25" min="0" value={f.marks} onChange={(e) => setF({ ...f, marks: e.target.value })} />
        <label>Detailed explanation</label>
        <textarea value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
        <button>Save question</button>
      </form>
      <h3>Question bank ({list.length})</h3>
      {list.map((q) => (
        <div className="card row" key={q.id}>
          <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{q.body}</span>
          <button className="danger" onClick={() => del(q.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}

function Exams() {
  const [qs, setQs] = useState([])
  const [cls, setCls] = useState([])
  const [exams, setExams] = useState([])
  const [f, setF] = useState({ title: '', class_id: '', duration_min: 30, negative_mark: 0 })
  const [pick, setPick] = useState([])
  const load = async () => {
    setQs((await sb.from('questions').select('id, body').order('id', { ascending: false })).data || [])
    setCls((await sb.from('classes').select('*').order('name')).data || [])
    setExams((await sb.from('exams').select('*, classes(name)').order('id', { ascending: false })).data || [])
  }
  useEffect(() => { load() }, [])
  const create = async (e) => {
    e.preventDefault()
    if (!pick.length) return alert('Select at least one question.')
    const { data, error } = await sb.from('exams').insert({ title: f.title, class_id: f.class_id || null, duration_min: +f.duration_min, negative_mark: +f.negative_mark }).select().single()
    if (error) return alert(error.message)
    const { error: e2 } = await sb.from('exam_questions').insert(pick.map((id) => ({ exam_id: data.id, question_id: id })))
    if (e2) return alert(e2.message)
    setPick([]); setF({ title: '', class_id: '', duration_min: 30, negative_mark: 0 }); load()
  }
  const toggle = async (x) => { await sb.from('exams').update({ published: !x.published }).eq('id', x.id); load() }
  const del = async (id) => { if (window.confirm('Delete exam and all its attempts?')) { await sb.from('exams').delete().eq('id', id); load() } }
  return (
    <div>
      <form className="card" onSubmit={create}>
        <label>Exam title</label>
        <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <label>For class</label>
        <select value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })}>
          <option value="">All classes</option>
          {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label>Duration (minutes)</label>
        <input type="number" min="1" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} />
        <label>Negative mark per wrong answer (0 for none)</label>
        <input type="number" step="0.25" min="0" value={f.negative_mark} onChange={(e) => setF({ ...f, negative_mark: e.target.value })} />
        <label>Select questions ({pick.length} chosen)</label>
        <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: 6 }}>
          {qs.map((q) => (
            <label className="opt" key={q.id}>
              <input type="checkbox" checked={pick.includes(q.id)} onChange={() => setPick(pick.includes(q.id) ? pick.filter((x) => x !== q.id) : [...pick, q.id])} />
              <span>{q.body.slice(0, 110)}</span>
            </label>
          ))}
        </div>
        <br /><button>Create exam</button>
      </form>
      {exams.map((x) => (
        <div className="card row" key={x.id}>
          <span><b>{x.title}</b> <small>{x.classes?.name || 'All classes'}, {x.duration_min} min, {x.published ? 'published' : 'draft'}</small></span>
          <span>
            <button className="ghost" onClick={() => toggle(x)}>{x.published ? 'Unpublish' : 'Publish'}</button>{' '}
            <button className="danger" onClick={() => del(x.id)}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  )
}

function Results() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    sb.from('attempts').select('*, exams(title), profiles(full_name, classes(name))').not('submitted_at', 'is', null).order('id', { ascending: false }).then(({ data }) => setRows(data || []))
  }, [])
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Student</th><th>Class</th><th>Exam</th><th>Score</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.profiles?.full_name}</td><td>{r.profiles?.classes?.name}</td><td>{r.exams?.title}</td><td>{r.score}/{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p>No submitted attempts yet.</p>}
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState('students')
  return (
    <div>
      <nav>
        {['students', 'import', 'questions', 'exams', 'results'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'students' && <Students />}
      {tab === 'import' && <Import />}
      {tab === 'questions' && <Questions />}
      {tab === 'exams' && <Exams />}
      {tab === 'results' && <Results />}
    </div>
  )
}
