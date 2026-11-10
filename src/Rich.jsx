import katex from 'katex'
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'

// Text with formulas: write $\ce{H2SO4}$ or $x^2$ ; everything else is shown as plain text.
export default function Rich({ text }) {
  if (!text) return null
  const parts = String(text).split(/(\$[^$\n]+\$)/g)
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) => {
        if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) {
          const html = katex.renderToString(p.slice(1, -1), { throwOnError: false })
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        }
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}
