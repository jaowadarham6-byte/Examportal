// Reads pasted MCQs: numbered questions, options A-E / a-e / ক-ঙ, answers, explanations, answer keys.
const toEn = (s) => s.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d))
const LET = { A: 0, B: 1, C: 2, D: 3, E: 4, a: 0, b: 1, c: 2, d: 3, e: 4, 'ক': 0, 'খ': 1, 'গ': 2, 'ঘ': 3, 'ঙ': 4, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 }
const L = 'A-Ea-eকখগঘঙ'
const NOT_LETTER = '(?![A-Za-z\\u0980-\\u09FF])'

const Q_START = /^(?:Q(?:uestion)?\.?\s*|প্রশ্ন\s*)?(\d{1,3})\s*[\)\.\:]\s*(.*)$/i
const OPT_START = new RegExp(`^[\\(\\[]?([${L}])[\\)\\]\\.]\\s+`)
const OPT_SPLIT = new RegExp(`\\s+(?=[\\(\\[]?[${L}][\\)\\]\\.]\\s)`)
const MARKED = /\s*(?:✓|✔|\*|\(correct\))\s*$/i
const ANS_LINE = new RegExp(`^(?:সঠিক\\s*)?(?:ans(?:wer)?|উত্তর|correct(?:\\s*answer)?)\\s*[:\\-\\.]?\\s*[\\(\\[]?([${L}1-5])${NOT_LETTER}`, 'i')
const EXPL = /^(?:explanation|exp|solution|ব্যাখ্যা|সমাধান)\s*[:\-]\s*(.*)$/i
const KEY_HEAD = /^(?:answers|answer\s*key|key|উত্তরমালা|উত্তরপত্র)\s*[:\-]?\s*$/i
const KEY_PREFIX = /^(?:answers?|answer\s*key|key|উত্তরমালা|উত্তরপত্র)\s*[:\-]\s*(?=\d)/i
const KEY_LINE = new RegExp(`^(?:\\s*\\d{1,3}\\s*[\\-\\.\\):]?\\s*[\\(\\[]?[${L}][\\)\\]]?${NOT_LETTER}[\\s,;|]*)+$`)
const PAIR = new RegExp(`(\\d{1,3})\\s*[\\-\\.\\):]?\\s*[\\(\\[]?([${L}])[\\)\\]]?${NOT_LETTER}`, 'g')

export function check(it) {
  const w = []
  if (it.options.length < 2) w.push('Fewer than 2 options found')
  if (it.correct === null || it.correct === undefined) w.push('No answer found: choose it below')
  else if (it.correct >= it.options.length) w.push('Answer does not match any option')
  return w
}

function run(text) {
  const items = []
  const key = {}
  let cur = null, state = 'body', inKey = false, last = 0
  const addPairs = (s) => { for (const m of s.matchAll(PAIR)) key[+m[1]] = LET[m[2]] }

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const n = toEn(line)

    if (KEY_HEAD.test(n)) { inKey = true; continue }
    if (inKey) { addPairs(n); continue }
    const nk = n.replace(KEY_PREFIX, '')
    if (KEY_LINE.test(nk)) { addPairs(nk); continue }

    const q = n.match(Q_START)
    if (q && (state !== 'expl' || +q[1] === last + 1)) {
      cur = { num: +q[1], body: line.slice(line.length - q[2].length), options: [], correct: null, explanation: '' }
      items.push(cur); state = 'body'; last = cur.num
      continue
    }
    if (!cur) continue

    const a = n.match(ANS_LINE)
    if (a) { cur.correct = LET[a[1]]; state = 'ans'; continue }
    const e = n.match(EXPL)
    if (e) { cur.explanation = line.slice(line.length - e[1].length); state = 'expl'; continue }
    if (state === 'expl') { cur.explanation += '\n' + line; continue }

    if (OPT_START.test(line)) {
      for (const part of line.split(OPT_SPLIT)) {
        const m = part.match(OPT_START)
        if (!m) continue
        let t = part.slice(m[0].length)
        if (MARKED.test(t)) { t = t.replace(MARKED, ''); cur.correct = cur.options.length }
        cur.options.push(t.trim())
      }
      state = 'opts'; continue
    }
    if (state === 'body') cur.body += '\n' + line
    else if (state === 'opts' && cur.options.length) cur.options[cur.options.length - 1] += ' ' + line
    else cur.explanation += (cur.explanation ? '\n' : '') + line
  }
  for (const it of items) if (it.correct === null && key[it.num] !== undefined) it.correct = key[it.num]
  return items
}

export function parseQuestions(text) {
  let items = run(text)
  // fallback: questions without numbers, separated by blank lines
  if (!items.length) items = run(text.split(/\n\s*\n/).map((c, i) => `${i + 1}. ${c}`).join('\n'))
  return items
}
