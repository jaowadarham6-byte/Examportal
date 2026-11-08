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
  const [sets, setSets] = useState([])
  const [qs, setQs] = useState([])
  const [cls, setCls] = useState([])
  const [setId, setSetId] = useState('')
  const [ns, setNs] = useState({ name: '', class_id: '' })
  const load = async () => {
    setSets((await sb.from('question_sets').select('*, classes(name)').order('id', { ascending: false })).data || [])
    setQs((await sb.from('questions').select('id, body, set_id').order('id')).data || [])
    setCls((await sb.from('classes').select('*').order('name')).data || [])
  }
  useEffect(() => { load() }, [])
  const addSet = async (e) => {
    e.preventDefault()
    const { error } = await sb.from('question_sets').insert({ name: ns.name.trim(), class_id: +ns.class_id })
    if (error) return alert(error.message)
    setNs({ name: '', class_id: '' }); load()
  }
  const delSet = async (s) => {
    if (!window.confirm(`Delete the set "${s.name}" and all its questions?`)) return
    const { error } = await sb.from('question_sets').delete().eq('id', s.id)
    if (error) alert('This set is used by an exam, so it cannot be deleted. Delete that exam first.')
    load()
  }
  const delQ = async (id) => {
    if (!window.confirm('Delete this question?')) return
    const { error } = await sb.from('questions').delete().eq('id', id)
    if (error) alert('This question is used by an exam, so it cannot be deleted.')
    load()
  }
  const save = async (e) => {
    e.preventDefault()
    if (!setId) return alert('Choose a set first.')
    const options = f.o.map((x) => x.trim()).filter(Boolean)
    if (options.length < 2) return alert('Enter at least 2 options, filled in order.')
    if (+f.correct >= options.length) return alert('Correct option is empty.')
    const { error } = await sb.from('questions').insert({ set_id: +setId, body: f.body, options, correct: +f.correct, explanation: f.explanation, marks: +f.marks })
    if (error) return alert(error.message)
    setF(blank); load()
  }
  const loose = qs.filter((q) => !q.set_id)
  const QRow = ({ q }) => (
    <div className="row" style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
      <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{q.body}</span>
      <button className="danger" onClick={() => delQ(q.id)}>Delete</button>
    </div>
  )
  return (
    <div>
      <form className="card" onSubmit={addSet}>
        <label>Create a new set</label>
        <input required value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="e.g. Chapter 3 Set A" />
        <select required value={ns.class_id} onChange={(e) => setNs({ ...ns, class_id: e.target.value })}>
          <option value="">Choose class</option>
          {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button>Create set</button>
      </form>

      <details className="card">
        <summary>Add one question by hand</summary>
        <form onSubmit={save}>
          <label>Set</label>
          <select value={setId} onChange={(e) => setSetId(e.target.value)}>
            <option value="">Choose set</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.classes?.name})</option>)}
          </select>
          <label>Question</label>
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
      </details>

      <h3>Sets</h3>
      {sets.length === 0 && <p className="card">No sets yet. Create one above or use the Import tab.</p>}
      {sets.map((s) => {
        const mine = qs.filter((q) => q.set_id === s.id)
        return (
          <details className="card" key={s.id}>
            <summary>{s.name} <small>({s.classes?.name || 'no class'}, {mine.length} questions)</small></summary>
            {mine.map((q) => <QRow key={q.id} q={q} />)}
            <br /><button className="danger" onClick={() => delSet(s)}>Delete whole set</button>
          </details>
        )
      })}
      {loose.length > 0 && (
        <details className="card">
          <summary>Questions with no set <small>({loose.length}, cannot be used in exams)</small></summary>
          {loose.map((q) => <QRow key={q.id} q={q} />)}
        </details>
      )}
    </div>
  )
}

function Exams() {
  const [sets, setSets] = useState([])
  const [qs, setQs] = useState([])
  const [cls, setCls] = useState([])
  const [exams, setExams] = useState([])
  const blank = { title: '', class_id: '', duration_min: 30, negative_mark: 0 }
  const [f, setF] = useState(blank)
  const [pick, setPick] = useState([])
  const load = async () => {
    setSets((await sb.from('question_sets').select('*, classes(name)').order('id', { ascending: false })).data || [])
    setQs((await sb.from('questions').select('id, set_id')).data || [])
    setCls((await sb.from('classes').select('*').order('name')).data || [])
    setExams((await sb.from('exams').select('*, classes(name), exam_questions(count)').order('id', { ascending: false })).data || [])
  }
  useEffect(() => { load() }, [])
  const count = (id) => qs.filter((q) => q.set_id === id).length
  const shown = f.class_id && f.class_id !== 'all' ? sets.filter((s) => s.class_id === +f.class_id) : sets
  const create = async (e) => {
    e.preventDefault()
    if (!pick.length) return alert('Select at least one set.')
    const { data: rows, error: e0 } = await sb.from('questions').select('id').in('set_id', pick)
    if (e0) return alert(e0.message)
    if (!rows.length) return alert('The selected sets have no questions.')
    const { data, error } = await sb.from('exams').insert({
      title: f.title, class_id: f.class_id === 'all' ? null : +f.class_id,
      duration_min: +f.duration_min, negative_mark: +f.negative_mark,
    }).select().single()
    if (error) return alert(error.message)
    const { error: e2 } = await sb.from('exam_questions').insert(rows.map((r) => ({ exam_id: data.id, question_id: r.id })))
    if (e2) return alert(e2.message)
    setPick([]); setF(blank); load()
  }
  const toggle = async (x) => { await sb.from('exams').update({ published: !x.published }).eq('id', x.id); load() }
  const del = async (id) => { if (window.confirm('Delete exam and all its attempts?')) { await sb.from('exams').delete().eq('id', id); load() } }
  return (
    <div>
      <form className="card" onSubmit={create}>
        <label>Exam title</label>
        <input required value={f.title} onChange={(e) => { setF({ ...f, title: e.target.value }) }} />
        <label>For class (only this class will see the exam)</label>
        <select required value={f.class_id} onChange={(e) => { setF({ ...f, class_id: e.target.value }); setPick([]) }}>
          <option value="">Choose class</option>
          {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="all">All classes</option>
        </select>
        <label>Duration (minutes)</label>
        <input type="number" min="1" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} />
        <label>Negative mark per wrong answer (0 for none)</label>
        <input type="number" step="0.25" min="0" value={f.negative_mark} onChange={(e) => setF({ ...f, negative_mark: e.target.value })} />
        <label>Select sets ({pick.length} chosen)</label>
        <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: 6 }}>
          {!f.class_id && <small>Choose a class first.</small>}
          {f.class_id && shown.length === 0 && <small>No sets for this class yet.</small>}
          {f.class_id && shown.map((s) => (
            <label className="opt" key={s.id}>
              <input type="checkbox" checked={pick.includes(s.id)} onChange={() => setPick(pick.includes(s.id) ? pick.filter((x) => x !== s.id) : [...pick, s.id])} />
              <span>{s.name} <small>({s.classes?.name}, {count(s.id)} questions)</small></span>
            </label>
          ))}
        </div>
        <br /><button>Create exam</button>
      </form>
      {exams.map((x) => (
        <div className="card row" key={x.id}>
          <span><b>{x.title}</b> <small>{x.classes?.name || 'All classes'}, {x.exam_questions?.[0]?.count ?? 0} questions, {x.duration_min} min, {x.published ? 'published' : 'draft'}</small></span>
          <span>
            <button className="ghost" onClick={() => toggle(x)}>{x.published ? 'Unpublish' : 'Publish'}</button>{' '}
            <button className="danger" onClick={() => del(x.id)}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  )
}

function Resources() {
  const [list, setList] = useState([])
  const [cls, setCls] = useState([])
  const blank = { title: '', url: '', note: '', class_id: '' }
  const [f, setF] = useState(blank)
  const load = async () => {
    setList((await sb.from('resources').select('*, classes(name)').order('id', { ascending: false })).data || [])
    setCls((await sb.from('classes').select('*').order('name')).data || [])
  }
  useEffect(() => { load() }, [])
  const add = async (e) => {
    e.preventDefault()
    if (!/^https?:\/\//i.test(f.url.trim())) return alert('The link must start with http:// or https://')
    const { error } = await sb.from('resources').insert({
      title: f.title, url: f.url.trim(), note: f.note, class_id: f.class_id === 'all' ? null : +f.class_id,
    })
    if (error) return alert(error.message)
    setF(blank); load()
  }
  const del = async (id) => { if (window.confirm('Delete this link?')) { await sb.from('resources').delete().eq('id', id); load() } }
  return (
    <div>
      <form className="card" onSubmit={add}>
        <label>Title</label>
        <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Class 5: Acids and Bases (recording)" />
        <label>Link</label>
        <input required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://..." />
        <label>Note for students (optional)</label>
        <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <label>Show to</label>
        <select required value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })}>
          <option value="">Choose class</option>
          {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="all">All classes</option>
        </select>
        <button>Add link</button>
      </form>
      {list.map((r) => (
        <div className="card row" key={r.id}>
          <span><a href={r.url} target="_blank" rel="noopener noreferrer"><b>{r.title}</b></a> <small>{r.classes?.name || 'All classes'}</small></span>
          <button className="danger" onClick={() => del(r.id)}>Delete</button>
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
        {['students', 'import', 'questions', 'exams', 'resources', 'results'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'students' && <Students />}
      {tab === 'import' && <Import />}
      {tab === 'questions' && <Questions />}
      {tab === 'exams' && <Exams />}
      {tab === 'resources' && <Resources />}
      {tab === 'results' && <Results />}
    </div>
  )
}
