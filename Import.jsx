import { useState } from 'react'
import { sb } from './supabase'
import { parseQuestions, check } from './parser'

const SAMPLE = `1. Which gas is released when Zn reacts with dilute HCl?
A) O2  B) H2  C) Cl2  D) N2
Ans: B
Explanation: Zn + 2HCl gives ZnCl2 and H2.

২. পানির সংকেত কোনটি?
ক. H2O
খ. CO2
গ. NaCl
ঘ. HCl
উত্তর: ক
ব্যাখ্যা: পানির অণুতে দুইটি হাইড্রোজেন ও একটি অক্সিজেন থাকে।`

export default function Import() {
  const [text, setText] = useState('')
  const [items, setItems] = useState(null)
  const [marks, setMarks] = useState(1)
  const [msg, setMsg] = useState('')

  const read = () => { setMsg(''); setItems(parseQuestions(text)) }
  const upd = (i, patch) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const drop = (i) => setItems(items.filter((_, k) => k !== i))

  const save = async () => {
    const ok = items.filter((x) => check(x).length === 0)
    if (!ok.length) return setMsg('Nothing is ready to save. Fix the items marked in red first.')
    const { error } = await sb.from('questions').insert(
      ok.map((x) => ({ body: x.body, options: x.options, correct: x.correct, explanation: x.explanation, marks: +marks }))
    )
    if (error) return setMsg(error.message)
    const left = items.filter((x) => check(x).length > 0)
    setItems(left.length ? left : null)
    if (!left.length) setText('')
    setMsg(`${ok.length} questions saved.${left.length ? ` ${left.length} still need fixing below.` : ' Now create an exam from the Exams tab.'}`)
  }

  const ready = items ? items.filter((x) => check(x).length === 0).length : 0
  return (
    <div>
      <div className="card">
        <label>Paste questions with answers (Bengali or English)</label>
        <textarea style={{ minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
        <small>
          Supported: numbered questions (1. or ১.), options A-E or ক-ঙ (one per line or all on one line),
          "Ans: B" or "উত্তর: খ", "Explanation:" or "ব্যাখ্যা:", a ✓ after the correct option,
          or an answer list at the end such as "Answers: 1-B 2-C".
        </small>
        <br /><br />
        <button onClick={read} disabled={!text.trim()}>Read questions</button>
      </div>

      {msg && <p className="card">{msg}</p>}

      {items && (
        <>
          <div className="card row">
            <span>{items.length} found, {ready} ready to save</span>
            <span>
              Marks each <input type="number" step="0.25" min="0" value={marks} onChange={(e) => setMarks(e.target.value)} style={{ width: 80, margin: '0 8px' }} />
              <button onClick={save}>Save {ready} questions</button>
            </span>
          </div>
          {items.length === 0 && <p className="card">No questions recognised. Check that each question starts with a number and options start with A), B) or ক), খ).</p>}
          {items.map((it, i) => {
            const w = check(it)
            return (
              <div className="card" key={i} style={w.length ? { borderColor: 'var(--bad)' } : {}}>
                <div className="row">
                  <b>Question {it.num}</b>
                  <button className="danger" onClick={() => drop(i)}>Remove</button>
                </div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{it.body}</p>
                {it.options.map((o, j) => (
                  <div key={j} className={j === it.correct ? 'ok' : 'plain'}>{'ABCDE'[j]}. {o}</div>
                ))}
                {w.map((x) => <p className="err" key={x}>{x}</p>)}
                <label>Correct option</label>
                <select value={it.correct ?? ''} onChange={(e) => upd(i, { correct: e.target.value === '' ? null : +e.target.value })}>
                  <option value="">Choose</option>
                  {it.options.map((_, j) => <option key={j} value={j}>{'ABCDE'[j]}</option>)}
                </select>
                <label>Explanation</label>
                <textarea value={it.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} />
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
