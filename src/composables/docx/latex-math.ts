import {
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathRadical,
  MathSum,
  MathIntegral,
} from 'docx'
import type { MathComponent } from 'docx'

// ===== LaTeX → docx Math (OMML) =====
// A pragmatic recursive-descent parser covering the LaTeX a student needs:
// fractions, super/subscripts, roots, sums/integrals, greek letters, operators,
// and parentheses. Unknown commands fall back to their literal text.

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ',
  psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
}
const OPERATORS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', leq: '≤', geq: '≥',
  neq: '≠', approx: '≈', equiv: '≡', infty: '∞', partial: '∂', nabla: '∇',
  rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', to: '→', cdots: '⋯',
  ldots: '…', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', sim: '∼',
}

interface LatexTokenizer { s: string; i: number }

function readGroup(t: LatexTokenizer): string {
  // Returns the raw content of a {..} group (or a single token if no brace).
  if (t.s[t.i] === '{') {
    let depth = 0
    const start = ++t.i
    while (t.i < t.s.length) {
      if (t.s[t.i] === '{') depth++
      else if (t.s[t.i] === '}') { if (depth === 0) break; depth-- }
      t.i++
    }
    const inner = t.s.slice(start, t.i)
    t.i++ // skip }
    return inner
  }
  if (t.s[t.i] === '\\') {
    const start = t.i++
    while (t.i < t.s.length && /[a-zA-Z]/.test(t.s[t.i]!)) t.i++
    return t.s.slice(start, t.i)
  }
  return t.s[t.i++] ?? ''
}

export function latexToMath(latex: string): MathComponent[] {
  const comps: MathComponent[] = []
  let textBuf = ''
  const flushText = () => {
    if (textBuf) { comps.push(new MathRun(textBuf)); textBuf = '' }
  }
  const t: LatexTokenizer = { s: latex, i: 0 }

  while (t.i < t.s.length) {
    const ch = t.s[t.i]!

    if (ch === '\\') {
      // command
      let j = t.i + 1
      while (j < t.s.length && /[a-zA-Z]/.test(t.s[j]!)) j++
      const cmd = t.s.slice(t.i + 1, j)
      t.i = j

      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        flushText()
        const numRaw = readGroup(t)
        const denRaw = readGroup(t)
        comps.push(new MathFraction({ numerator: latexToMath(numRaw), denominator: latexToMath(denRaw) }))
      } else if (cmd === 'sqrt') {
        flushText()
        // optional [n] degree is ignored for simplicity
        if (t.s[t.i] === '[') { while (t.i < t.s.length && t.s[t.i] !== ']') t.i++; t.i++ }
        const rad = readGroup(t)
        comps.push(new MathRadical({ children: latexToMath(rad) }))
      } else if (cmd === 'sum') {
        flushText()
        comps.push(new MathSum({ children: [new MathRun('')] }))
      } else if (cmd === 'int') {
        flushText()
        comps.push(new MathIntegral({ children: [new MathRun('')] }))
      } else if (cmd === 'left' || cmd === 'right') {
        // brackets handled by literal char following; skip the command itself
      } else if (GREEK[cmd]) {
        textBuf += GREEK[cmd]
      } else if (OPERATORS[cmd]) {
        textBuf += OPERATORS[cmd]
      } else {
        textBuf += cmd // unknown: literal name
      }
    } else if (ch === '^' || ch === '_') {
      t.i++
      const sup = ch === '^'
      const baseComps: MathComponent[] = textBuf ? [new MathRun(textBuf.slice(0, -1) || textBuf)] : []
      // Base is the previous single char/group. Simplify: use last buffered char.
      let base: MathComponent[]
      if (textBuf) {
        const last = textBuf.slice(-1)
        textBuf = textBuf.slice(0, -1)
        flushText()
        base = [new MathRun(last)]
      } else if (comps.length) {
        base = [comps.pop()!]
      } else {
        base = [new MathRun('')]
      }
      void baseComps
      const exp = latexToMath(readGroup(t))
      if (sup) comps.push(new MathSuperScript({ children: base, superScript: exp }))
      else comps.push(new MathSubScript({ children: base, subScript: exp }))
    } else if (ch === '{' || ch === '}') {
      t.i++ // stray braces ignored
    } else if (ch === ' ') {
      t.i++
    } else {
      textBuf += ch
      t.i++
    }
  }
  flushText()
  if (comps.length === 0) comps.push(new MathRun(latex))
  return comps
}
