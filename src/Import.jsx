import { useEffect, useState } from 'react'
import { sb } from './supabase'
import Rich from './Rich'
import { parseQuestions, check } from './parser'

const SAMPLE = `[ উদ্দীপক ১ ]
নিম্নের খাদ্যশৃঙ্খলটি পর্যবেক্ষণ করো:
শৈবাল $\\rightarrow$ জুপ্লাংকটন $\\rightarrow$ ছোট মাছ
৮১. উদ্দীপকে জুপ্লাংকটন কোন ট্রফিক লেভেলে আছে?
ক) ১ম
খ) ২য়
গ) ৩য়
ঘ) ৪র্থ
উত্তর: খ
৮২. ছোট মাছ না থাকলে কী হবে?
ক) ...
খ) ...
উত্তর: ক

৮৩. সাধারণ প্রশ্ন (উদ্দীপক ছাড়া)
A) O2  B) H2  C) Cl2  D) N2
Ans: B
Explanation: Zn + 2HCl gives ZnCl2 and H2.`

export default function Import() {
  const [text, setText] = useState('')
  const [items, setItems] = useState(null)
  const [stimuli, setStimuli] = useState([])
  const [savedStim, setSavedStim] = useState({})
  const [perStim, setPerStim] = useState(2)
  const [marks, setMarks] = useState(1)
  const [msg, setMsg] = useState('')
  const [classes, setClasses] = useState([])
  const [sets, setSets] = useState([])
  const [setId, setSetId] = useState('') // '' = create a new set
  const [name, setName] = useState('')
  const [classId, setClassId] = useState('')

  const loadSets = async () => {
    setClasses((await sb.from('classes').select('*').order('name')).data || [])
    setSets((await sb.from('question_sets').select('*, classes(name)').order('id', { ascending: false })).data || [])
  }
  useEffect(() => { loadSets() }, [])

  const read = () => {
    setMsg(''); setSavedStim({})
    const r = parseQuestions(text, +perStim)
    setItems(r.items); setStimuli(r.stimuli)
  }
  const upd = (i, patch) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const drop = (i) => setItems(items.filter((_, k) => k !== i))
  const setStimBody = (k, body) => setStimuli(stimuli.map((s, j) => (j === k ? { ...s, body } : s)))
  const removeStim = (k) => {
    setStimuli(stimuli.map((s, j) => (j === k ? null : s)))
    setItems(items.map((x) => (x.stimIdx === k ? { ...x, stimIdx: null } : x)))
  }

  const save = async () => {
    const ok = items.filter((x) => check(x).length === 0)
    if (!ok.length) return setMsg('Nothing is ready to save. Fix the items marked in red first.')
    const used = [...new Set(ok.map((x) => x.stimIdx).filter((v) => v !== null && stimuli[v]))]
    for (const k of used) if (!stimuli[k].body.trim()) return setMsg(`Stimulus ${k + 1} has no text.`)

    let sid = setId
    if (!sid) {
      if (!name.trim() || !classId) return setMsg('Choose a class and type a name for the new set (top of this page).')
      const { data, error } = await sb.from('question_sets').insert({ name: name.trim(), class_id: +classId }).select().single()
      if (error) return setMsg(error.message)
      sid = String(data.id)
    }
    const idMap = { ...savedStim }
    for (const k of used) {
      const key = `${sid}-${k}`
      if (idMap[key]) continue
      const { data, error } = await sb.from('stimuli').insert({ set_id: +sid, body: stimuli[k].body.trim() }).select().single()
      if (error) return setMsg(error.message)
      idMap[key] = data.id
    }
    const { error } = await sb.from('questions').insert(
      ok.map((x) => ({
        set_id: +sid, body: x.body, options: x.options, correct: x.correct, explanation: x.explanation, marks: +marks,
        stimulus_id: x.stimIdx !== null && stimuli[x.stimIdx] ? idMap[`${sid}-${x.stimIdx}`] : null,
      }))
    )
    if (error) return setMsg(error.message)
    setSavedStim(idMap)
    const left = items.filter((x) => check(x).length > 0)
    setItems(left.length ? left : null)
    if (!left.length) { setText(''); setStimuli([]); setSavedStim({}) }
    setSetId(sid)
    await loadSets()
    setMsg(`${ok.length} questions saved to the set.${left.length ? ` ${left.length} still need fixing below.` : ' Now create an exam from the Exams tab.'}`)
  }

  const ready = items ? items.filter((x) => check(x).length === 0).length : 0
  const nStim = stimuli.filter(Boolean).length
  return (
    <div>
      <div className="card">
        <label>Save these questions into</label>
        <select value={setId} onChange={(e) => setSetId(e.target.value)}>
          <option value="">+ Create a new set</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.classes?.name || 'no class'})</option>
          ))}
        </select>
        {!setId && (
          <>
            <label>New set name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chapter 3 Set A" />
            <label>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Choose class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="card">
        <label>Paste questions with answers (Bengali or English)</label>
        <textarea style={{ minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
        <label>Questions per stimulus (0 = until the next stimulus)</label>
        <input type="number" min="0" max="20" value={perStim} onChange={(e) => setPerStim(e.target.value)} style={{ width: 100 }} />
        <small>
          A line like [ উদ্দীপক ৫ ] starts a stimulus. Its text runs until the first numbered question, and the next
          questions (as many as set above) are attached to it. Other questions stay normal. Supported: numbered
          questions (1. or ১.), options A-E or ক-ঙ, "Ans: B" or "উত্তর: খ", "Explanation:" or "ব্যাখ্যা:",
          a ✓ after the correct option, or an answer list at the end such as "Answers: 1-B 2-C".
        </small>
        <br /><br />
        <button onClick={read} disabled={!text.trim()}>Read questions</button>
      </div>

      {msg && <p className="card">{msg}</p>}

      {items && (
        <>
          <div className="card row">
            <span>{items.length} questions, {nStim} stimuli, {ready} ready to save</span>
            <span>
              Marks each <input type="number" step="0.25" min="0" value={marks} onChange={(e) => setMarks(e.target.value)} style={{ width: 80, margin: '0 8px' }} />
              <button onClick={save}>Save {ready} questions</button>
            </span>
          </div>
          {items.length === 0 && <p className="card">No questions recognised. Check that each question starts with a number and options start with A), B) or ক), খ).</p>}
          {items.map((it, i) => {
            const w = check(it)
            const first = it.stimIdx !== null && stimuli[it.stimIdx] && items.findIndex((x) => x.stimIdx === it.stimIdx) === i
            return (
              <div key={i}>
                {first && (
                  <div className="card stim">
                    <div className="row">
                      <b>Stimulus {it.stimIdx + 1}</b>
                      <button className="danger" onClick={() => removeStim(it.stimIdx)}>Remove stimulus</button>
                    </div>
                    <p><Rich text={stimuli[it.stimIdx].body} /></p>
                    <label>Edit stimulus text</label>
                    <textarea value={stimuli[it.stimIdx].body} onChange={(e) => setStimBody(it.stimIdx, e.target.value)} />
                  </div>
                )}
                <div className="card" style={w.length ? { borderColor: 'var(--bad)' } : {}}>
                  <div className="row">
                    <b>Question {it.num}</b>
                    <button className="danger" onClick={() => drop(i)}>Remove</button>
                  </div>
                  <p><Rich text={it.body} /></p>
                  {it.options.map((o, j) => (
                    <div key={j} className={j === it.correct ? 'ok' : 'plain'}>{'ABCDE'[j]}. <Rich text={o} /></div>
                  ))}
                  {w.map((x) => <p className="err" key={x}>{x}</p>)}
                  <label>Correct option</label>
                  <select value={it.correct ?? ''} onChange={(e) => upd(i, { correct: e.target.value === '' ? null : +e.target.value })}>
                    <option value="">Choose</option>
                    {it.options.map((_, j) => <option key={j} value={j}>{'ABCDE'[j]}</option>)}
                  </select>
                  <label>Stimulus</label>
                  <select value={it.stimIdx ?? ''} onChange={(e) => upd(i, { stimIdx: e.target.value === '' ? null : +e.target.value })}>
                    <option value="">None</option>
                    {stimuli.map((s, k) => s && <option key={k} value={k}>Stimulus {k + 1}</option>)}
                  </select>
                  <label>Explanation</label>
                  <textarea value={it.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} />
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
