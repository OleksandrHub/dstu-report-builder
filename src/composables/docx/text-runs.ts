import { TextRun } from 'docx'

export interface FontConfig {
  name: string
  size: number // half-points
  lineSpacing: number
  paragraphIndent: number // cm
  color?: string // hex without '#'
}

export interface RunStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  mono?: boolean
  color?: string // hex without '#', overrides cfg.color for this run
}

export function styledRun(text: string, cfg: FontConfig, st: RunStyle): TextRun {
  return new TextRun({
    text,
    font: st.mono ? 'Courier New' : cfg.name,
    size: cfg.size,
    bold: st.bold,
    italics: st.italic,
    underline: st.underline ? {} : undefined,
    color: st.color ?? cfg.color,
  })
}

export function baseRun(text: string, cfg: FontConfig, bold = false, italic = false): TextRun {
  return styledRun(text, cfg, { bold, italic })
}

// Inline formatting markers. The parser is stateful: a marker toggles its style
// on/off, so styles nest and combine freely, e.g.
//   ***bold italic***  →  **_x_**  →  *a `b`*  all work.
//   **bold**   *italic*   __underline__   `mono`
type BoolStyleKey = 'bold' | 'italic' | 'underline' | 'mono'
const MARKERS: Array<{ tok: string; key: BoolStyleKey }> = [
  { tok: '**', key: 'bold' },
  { tok: '__', key: 'underline' },
  { tok: '*', key: 'italic' },
  { tok: '`', key: 'mono' },
]

// Inline color marker: {#RRGGBB|colored text} or {/} alone resets to default.
// Escape any marker char with a backslash: \*  \_  \`  \{  \}  \\
export function inlineRuns(text: string, cfg: FontConfig, baseBold = false): TextRun[] {
  const runs: TextRun[] = []
  const active: RunStyle = { bold: baseBold }
  // Color is a stack so nested {#..|..} restore the outer color on close.
  const colorStack: (string | undefined)[] = []
  let buf = ''

  const flush = () => {
    if (buf) {
      runs.push(styledRun(buf, cfg, { ...active }))
      buf = ''
    }
  }

  let i = 0
  while (i < text.length) {
    const ch = text[i]!

    // Backslash escape: emit the next char literally.
    if (ch === '\\' && i + 1 < text.length) {
      buf += text[i + 1]
      i += 2
      continue
    }

    if (active.mono) {
      if (ch === '`') { flush(); active.mono = false; i += 1; continue }
      buf += ch; i += 1; continue
    }

    // Open color: {#RRGGBB| or {#RGB|
    const colorOpen = /^\{#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\|/.exec(text.slice(i))
    if (colorOpen) {
      flush()
      let hex = colorOpen[1]!.toUpperCase()
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
      colorStack.push(active.color)
      active.color = hex
      i += colorOpen[0].length
      continue
    }
    // Close color: }
    if (ch === '}' && colorStack.length) {
      flush()
      active.color = colorStack.pop()
      i += 1
      continue
    }

    let matched = false
    for (const { tok, key } of MARKERS) {
      if (text.startsWith(tok, i)) {
        flush()
        active[key] = !active[key]
        i += tok.length
        matched = true
        break
      }
    }
    if (!matched) { buf += ch; i += 1 }
  }
  flush()
  if (runs.length === 0) runs.push(styledRun('', cfg, { bold: baseBold }))
  return runs
}
