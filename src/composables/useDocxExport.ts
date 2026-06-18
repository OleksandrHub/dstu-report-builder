import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  Header,
  Footer,
  SimpleField,
  SectionType,
  Bookmark,
  InternalHyperlink,
  Math as DocMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathRadical,
  MathSum,
  MathIntegral,
  TabStopType,
  convertInchesToTwip,
  convertMillimetersToTwip,
} from 'docx'
import type { MathComponent } from 'docx'
import type { ReportDocument, ReportBlock, ListItem, TitleLineBlock, TitleSpacerBlock, TableRow as DocTableRow, HeaderFooterConfig, NumberingSchemes } from '../types/document'
import { resolveTitleVars, formatSourceDSTU } from '../types/document'
import { renderFormulaPng, type FormulaImage } from './useFormulaImage'

const CM_TO_EMU = 914400 / 2.54

function cmToTwip(cm: number): number {
  return convertInchesToTwip(cm / 2.54)
}

function ptToHalfPt(pt: number): number {
  return pt * 2
}

interface FontConfig {
  name: string
  size: number // half-points
  lineSpacing: number
  paragraphIndent: number // cm
  color?: string // hex without '#'
}

interface RunStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  mono?: boolean
}

function styledRun(text: string, cfg: FontConfig, st: RunStyle): TextRun {
  return new TextRun({
    text,
    font: st.mono ? 'Courier New' : cfg.name,
    size: cfg.size,
    bold: st.bold,
    italics: st.italic,
    underline: st.underline ? {} : undefined,
    color: cfg.color,
  })
}

function baseRun(text: string, cfg: FontConfig, bold = false, italic = false): TextRun {
  return styledRun(text, cfg, { bold, italic })
}

// Inline formatting markers, longest-first so ** wins over *:
//   **bold**   *italic*   __underline__   `mono`
// `baseBold` is the block's default weight, so **...** toggles relative to it.
const INLINE_MARKERS: Array<{ re: RegExp; key: keyof RunStyle }> = [
  { re: /^\*\*([\s\S]+?)\*\*/, key: 'bold' },
  { re: /^__([\s\S]+?)__/, key: 'underline' },
  { re: /^\*([\s\S]+?)\*/, key: 'italic' },
  { re: /^`([^`]+?)`/, key: 'mono' },
]

function inlineRuns(text: string, cfg: FontConfig, baseBold = false): TextRun[] {
  const runs: TextRun[] = []
  let buf = ''
  let i = 0
  const flush = () => {
    if (buf) { runs.push(styledRun(buf, cfg, { bold: baseBold })); buf = '' }
  }
  while (i < text.length) {
    const rest = text.slice(i)
    let matched = false
    for (const { re, key } of INLINE_MARKERS) {
      const m = re.exec(rest)
      if (m) {
        flush()
        const st: RunStyle = key === 'bold' ? { bold: !baseBold } : { bold: baseBold, [key]: true }
        runs.push(styledRun(m[1] ?? '', cfg, st))
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) { buf += text[i]; i++ }
  }
  flush()
  if (runs.length === 0) runs.push(styledRun('', cfg, { bold: baseBold }))
  return runs
}

function bodyParagraph(
  runs: TextRun[],
  cfg: FontConfig,
  noIndent = false,
  alignment: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED
): Paragraph {
  return new Paragraph({
    children: runs,
    alignment,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    indent: noIndent ? undefined : { firstLine: cmToTwip(cfg.paragraphIndent) },
  })
}

function emptyParagraph(cfg: FontConfig): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '', font: cfg.name, size: cfg.size })],
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
  })
}

function captionParagraph(text: string, cfg: FontConfig, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT): Paragraph {
  // Left-aligned captions get the document's first-line indent (like body text,
  // e.g. "Таблиця 1 – ..."). Right/center captions (e.g. continuation) don't.
  const indent = align === AlignmentType.LEFT ? { firstLine: cmToTwip(cfg.paragraphIndent) } : undefined
  return new Paragraph({
    children: inlineRuns(text, cfg),
    alignment: align,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    indent,
  })
}

const ALIGN_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

const ALIGN4_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

// ===== Caption numbering =====
// Three schemes:
//   plain      → 1, 2, 3            (continuous, ignores chapters)
//   perSection → 1.1, 1.2, 1.3      (chapter fixed at 1, item runs continuously)
//   sectioned  → 1.1 … 2.1          (chapter = H2 index, item resets each chapter)
type NumKind = 'image' | 'code' | 'table' | 'formula'
interface Counters {
  bumpChapter(): void                       // call on every H2 heading
  next(kind: NumKind): string               // returns the formatted number for a type
}

// Each type can use its own scheme. The chapter counter advances on every H2;
// 'sectioned' types reset their per-chapter item count when that happens.
function makeCounters(schemes: NumberingSchemes): Counters {
  let chapter = 0
  const items: Record<NumKind, number> = { image: 0, code: 0, table: 0, formula: 0 }
  return {
    bumpChapter() {
      chapter++
      // Reset only the item counters whose scheme is section-based.
      ;(['image', 'code', 'table', 'formula'] as NumKind[]).forEach((k) => {
        if (schemes[k] === 'sectioned') items[k] = 0
      })
    },
    next(kind: NumKind): string {
      items[kind]++
      const m = items[kind]
      const scheme = schemes[kind]
      if (scheme === 'plain') return String(m)
      const ch = scheme === 'sectioned' ? Math.max(1, chapter) : 1
      return `${ch}.${m}`
    },
  }
}

// Build the in-text reference sentence for a numbered object (code/image/table).
// If the user's text contains the {no} placeholder, only substitute the number
// (no auto prefix). Otherwise fall back to the legacy "<text> <prefix> <n>." format.
function resolveReference(text: string | undefined, prefix: string, num: string): string {
  if (!text) return ''
  if (text.includes('{no}')) {
    return text.replace(/\{no\}/g, num)
  }
  return `${text} ${prefix.toLowerCase()} ${num}.`
}

// Bookmark id for a heading block, referenced by the manual table of contents.
function tocBookmarkId(blockId: string): string {
  return '_Toc_' + blockId.replace(/[^a-zA-Z0-9]/g, '')
}

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
    let depth = 0, start = ++t.i
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

function latexToMath(latex: string): MathComponent[] {
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

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function buildFormulaParagraph(
  latex: string,
  cfg: FontConfig,
  numbered: boolean,
  num: string,
  contentTwips: number,
  img?: FormulaImage,
): Paragraph {
  const lineSpacing = { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never }

  // Preferred: KaTeX-rendered PNG (renders in Word, OnlyOffice, and preview).
  // Fallback: native OMML math when the image could not be produced.
  let mathChild: ImageRun | DocMath
  if (img) {
    // The PNG was rendered at fontSizePx ≈ fontSize*1.6; convert px → pt (×0.75).
    const wPt = img.width * 0.75
    const hPt = img.height * 0.75
    mathChild = new ImageRun({
      data: dataUrlToBytes(img.dataUrl),
      transformation: { width: Math.round(wPt), height: Math.round(hPt) },
      type: 'png',
    })
  } else {
    try {
      mathChild = new DocMath({ children: latexToMath(latex) })
    } catch {
      mathChild = new DocMath({ children: [new MathRun(latex)] })
    }
  }

  if (numbered) {
    return new Paragraph({
      children: [
        new TextRun({ text: '\t', font: cfg.name, size: cfg.size }),
        mathChild,
        new TextRun({ text: `\t(${num})`, font: cfg.name, size: cfg.size }),
      ],
      spacing: lineSpacing,
      tabStops: [
        { type: TabStopType.CENTER, position: Math.round(contentTwips / 2) },
        { type: TabStopType.RIGHT, position: contentTwips },
      ],
    })
  }
  return new Paragraph({ children: [mathChild], alignment: AlignmentType.CENTER, spacing: lineSpacing })
}

function buildTitlePage(doc: ReportDocument, cfg: FontConfig): Paragraph[] {
  const result: Paragraph[] = []

  for (const block of doc.titleTemplate) {
    if (block.type === 'titleSpacer') {
      const spacer = block as TitleSpacerBlock
      const lineVal = Math.round(cfg.lineSpacing * 240)
      for (let i = 0; i < spacer.lines; i++) {
        result.push(new Paragraph({
          children: [new TextRun({ text: '', size: cfg.size, font: cfg.name })],
          spacing: { before: 0, after: 0, line: lineVal, lineRule: 'auto' as never },
        }))
      }
    } else {
      const line = block as TitleLineBlock
      const resolved = resolveTitleVars(line.text, doc.titlePage)
      result.push(new Paragraph({
        children: inlineRuns(resolved, cfg, line.bold),
        alignment: ALIGN_MAP[line.align] ?? AlignmentType.LEFT,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
        indent: {
          left: line.paddingLeft ? cmToTwip(line.paddingLeft) : undefined,
          right: line.paddingRight ? cmToTwip(line.paddingRight) : undefined,
        },
      }))
    }
  }

  return result
}


type BodyEl = Paragraph | Table

function buildBlock(
  block: ReportBlock,
  doc: ReportDocument,
  cfg: FontConfig,
  counters: Counters,
  out: { inlineRef?: string } = {},
  formulaImages: Map<string, FormulaImage> = new Map(),
): BodyEl[] {
  const s = doc.settings

  if (block.type === 'paragraph') {
    const pCfg = { ...cfg }
    if (block.fontSize) pCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) pCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) pCfg.lineSpacing = block.lineSpacing
    if (block.indent !== undefined) pCfg.paragraphIndent = block.indent
    if (block.color) pCfg.color = block.color

    const alignment = ALIGN4_MAP[block.align ?? 'justify'] ?? AlignmentType.JUSTIFIED
    const noIndent = block.align === 'center' || block.align === 'right'

    return [bodyParagraph(inlineRuns(block.text, pCfg, block.bold ?? false), pCfg, noIndent, alignment)]
  }

  if (block.type === 'heading') {
    // H2 starts a new chapter (only matters for the 'sectioned' scheme).
    if (block.level === 2) counters.bumpChapter()
    const levelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }
    const hCfg = { ...cfg }
    if (block.fontSize) hCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) hCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) hCfg.lineSpacing = block.lineSpacing
    if (block.indent !== undefined) hCfg.paragraphIndent = block.indent
    if (block.color) hCfg.color = block.color

    const hAlign = ALIGN4_MAP[block.align ?? 'center'] ?? AlignmentType.CENTER
    const hBold = block.bold ?? true
    const hIndent = block.indent !== undefined ? { firstLine: cmToTwip(block.indent) } : undefined

    return [
      new Paragraph({
        // Bookmark the heading so the manual TOC can PAGEREF it.
        children: [
          new Bookmark({ id: tocBookmarkId(block.id), children: inlineRuns(block.text, hCfg, hBold) }),
        ],
        heading: levelMap[block.level],
        alignment: hAlign,
        spacing: { line: Math.round(hCfg.lineSpacing * 240), lineRule: 'auto' as never },
        indent: hIndent,
      }),
    ]
  }

  if (block.type === 'pageBreak') {
    return [new Paragraph({ children: [new PageBreak()] })]
  }

  if (block.type === 'toc') {
    const title = block.title ?? 'Зміст'
    const result: BodyEl[] = [
      new Paragraph({
        children: inlineRuns(title, cfg, true),
        alignment: AlignmentType.CENTER,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
      }),
    ]

    // Build VISIBLE entries from the document's headings so the TOC shows up in
    // every viewer (SuperDoc/OnlyOffice don't recompute the TOC field). Each
    // entry: hyperlink to the heading + dot leader + PAGEREF page number.
    const contentTwips = cmToTwip(21 - s.marginLeft - s.marginRight)
    const headings = doc.blocks.filter(
      (b): b is Extract<ReportBlock, { type: 'heading' }> => b.type === 'heading',
    )
    for (const h of headings) {
      const bm = tocBookmarkId(h.id)
      const indent = (h.level - 1) * 0.75 // cm per level
      const plain = h.text.replace(/\*\*|__|[*`]/g, '')
      result.push(new Paragraph({
        // The whole line (text + dot leader + page number) is one hyperlink to
        // the heading, like Word's native TOC entries.
        children: [
          new InternalHyperlink({
            anchor: bm,
            children: [
              new TextRun({ text: plain, font: cfg.name, size: cfg.size }),
              new TextRun({ text: '\t', font: cfg.name, size: cfg.size }),
              new SimpleField(`PAGEREF ${bm} \\h`),
            ],
          }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: contentTwips, leader: 'dot' as never }],
        indent: { left: cmToTwip(indent) },
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
      }))
    }

    if (headings.length === 0) {
      result.push(bodyParagraph([baseRun('(немає заголовків для змісту)', cfg, false, true)], cfg, true))
    }
    return result
  }

  if (block.type === 'spacer') {
    const n = Math.max(1, block.lines ?? 1)
    return Array.from({ length: n }, () => emptyParagraph(cfg))
  }

  if (block.type === 'sources') {
    const result: BodyEl[] = []
    const title = block.title ?? 'Список використаних джерел'
    result.push(new Paragraph({
      children: inlineRuns(title, cfg, true),
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    }))
    block.entries.forEach((e, i) => {
      const text = formatSourceDSTU(e)
      result.push(new Paragraph({
        children: [baseRun(`${i + 1}. ${text}`, cfg)],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
        indent: { left: cmToTwip(0.75), hanging: cmToTwip(0.75) },
      }))
    })
    return result
  }

  if (block.type === 'columns') {
    const contentTwips = cmToTwip(21 - s.marginLeft - s.marginRight)
    const cols = block.columns
    const total = cols.reduce((a, c) => a + (c.width || 0), 0) || cols.length
    const colTwips = cols.map(c => Math.round(contentTwips * (c.width || 100 / cols.length) / total))
    const noBorder = {
      top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
    }
    // Render each column's nested blocks; only paragraph-like children are kept
    // (tables/TOC inside a column cell aren't supported).
    const row = new TableRow({
      children: cols.map((col, i) => new TableCell({
        width: { size: colTwips[i] ?? 0, type: WidthType.DXA },
        borders: noBorder,
        children: col.blocks.flatMap(inner => {
          const els = buildBlock(inner, doc, cfg, counters)
          return els.filter((el): el is Paragraph => el instanceof Paragraph)
        }),
      })),
    })
    return [new Table({ rows: [row], width: { size: contentTwips, type: WidthType.DXA }, columnWidths: colTwips, borders: { ...noBorder, insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 } } })]
  }

  if (block.type === 'formula') {
    const num = counters.next('formula')
    const result: BodyEl[] = []

    const refText = resolveReference(block.referenceText, s.formulaPrefix, num)
    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }

    const numbered = block.numbered !== false
    const contentTwips = cmToTwip(21 - s.marginLeft - s.marginRight)
    const img = formulaImages.get(block.id)
    result.push(buildFormulaParagraph(block.latex, cfg, numbered, num, contentTwips, img))

    if (block.caption) {
      result.push(captionParagraph(`${s.formulaPrefix} ${num} – ${block.caption}`, cfg))
    }

    return result
  }

  if (block.type === 'list') {
    const result: Paragraph[] = []

    if (block.introText) {
      result.push(bodyParagraph(inlineRuns(block.introText, cfg), cfg))
    }

    block.items.forEach((item: ListItem, idx: number) => {
      const isLast = idx === block.items.length - 1
      let text = item.text.trim()
      if (!text) return

      if (block.ordered) {
        text = text.charAt(0).toUpperCase() + text.slice(1)
        text = text.replace(/[;.,]$/, '') + '.'
        result.push(
          new Paragraph({
            children: inlineRuns(`${idx + 1}. ${text}`, cfg),
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
            indent: { firstLine: cmToTwip(cfg.paragraphIndent) },
          })
        )
      } else {
        text = text.charAt(0).toLowerCase() + text.slice(1)
        text = text.replace(/[;.,]$/, '') + (isLast ? '.' : ';')
        result.push(
          new Paragraph({
            children: inlineRuns(`– ${text}`, cfg),
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
            indent: { left: cmToTwip(cfg.paragraphIndent) },
          })
        )
      }
    })

    return result
  }

  if (block.type === 'code') {
    const num = counters.next('code')
    const result: BodyEl[] = []
    const codeSize = ptToHalfPt(block.fontSize ?? 12)
    const codeSpacing = block.lineSpacing ?? 1.0

    const refText = resolveReference(block.referenceText, s.listingPrefix, num)

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))
    result.push(captionParagraph(`${s.listingPrefix} ${num} – ${block.caption}`, cfg))
    result.push(
      new Paragraph({
        children: [new TextRun({ text: block.code, font: 'Courier New', size: codeSize })],
        spacing: { line: Math.round(codeSpacing * 240), lineRule: 'auto' as never },
      })
    )
    result.push(emptyParagraph(cfg))

    return result
  }

  if (block.type === 'image') {
    const num = counters.next('image')
    const result: BodyEl[] = []

    const refText = resolveReference(block.referenceText, s.imagePrefix, num)

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))

    if (block.src && block.src.startsWith('data:')) {
      try {
        const base64 = block.src.split(',')[1] ?? ''
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

        result.push(
          new Paragraph({
            children: [new ImageRun({ data: bytes, transformation: { width: 400, height: 300 }, type: 'png' })],
            alignment: AlignmentType.CENTER,
          })
        )
      } catch {
        result.push(bodyParagraph([baseRun('[Зображення]', cfg, false, true)], cfg, true))
      }
    }

    result.push(
      new Paragraph({
        children: inlineRuns(`${s.imagePrefix} ${num} – ${block.caption}`, cfg),
        alignment: AlignmentType.CENTER,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
      })
    )
    result.push(emptyParagraph(cfg))

    return result
  }

  if (block.type === 'table') {
    const num = counters.next('table')
    const result: BodyEl[] = []
    const tblSize = ptToHalfPt(block.fontSize ?? 12)
    const tblSpacing = block.lineSpacing ?? 1.0
    const tCfg = { ...cfg, size: tblSize, lineSpacing: tblSpacing }
    const ROWS_PER_PAGE = 20 // split threshold

    const refText = block.referenceText
      ? (block.referenceText.includes('{no}')
          ? block.referenceText.replace(/\{no\}/g, num)
          : `У ${s.tablePrefix.toLowerCase()} ${num} ${block.referenceText.toLowerCase()}.`)
      : ''

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))

    const makeBorder = () => ({
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    })

    // Content width (twips) available for the table = page width − L/R margins.
    const A4_WIDTH_CM = 21
    const contentTwips = cmToTwip(A4_WIDTH_CM - s.marginLeft - s.marginRight)
    const colCount = block.headers.length

    // Per-column width in twips. Use explicit columnWidths (% → twips) when valid,
    // otherwise distribute evenly.
    const widths = block.columnWidths
    const hasWidths = Array.isArray(widths) && widths.length === colCount && widths.some(w => w > 0)
    const colTwips: number[] = []
    for (let i = 0; i < colCount; i++) {
      const pct = hasWidths ? (widths![i] || 0) : 100 / colCount
      colTwips.push(Math.round(contentTwips * pct / 100))
    }

    const cellWidth = (i: number) => ({ size: colTwips[i] ?? 0, type: WidthType.DXA })

    const makeHeaderRow = () => new TableRow({
      children: block.headers.map((h, i) =>
        new TableCell({
          children: [new Paragraph({ children: inlineRuns(h, tCfg, true), alignment: AlignmentType.CENTER, spacing: { line: Math.round(tblSpacing * 240), lineRule: 'auto' as never } })],
          borders: makeBorder(),
          width: cellWidth(i),
        })
      ),
      tableHeader: true,
    })

    const makeDataRow = (row: DocTableRow) => new TableRow({
      children: row.cells.map((cell, i) =>
        new TableCell({
          children: [new Paragraph({ children: inlineRuns(cell.text, tCfg), spacing: { line: Math.round(tblSpacing * 240), lineRule: 'auto' as never } })],
          borders: makeBorder(),
          width: cellWidth(i),
        })
      ),
    })

    // fullWidth (default true) stretches to content width; otherwise auto-fit.
    const fullWidth = block.fullWidth !== false
    const tableWidth = fullWidth
      ? { size: contentTwips, type: WidthType.DXA }
      : { size: 0, type: WidthType.AUTO }

    // First split at manual breakpoints (rows flagged with splitBefore),
    // then split each manual segment further if it exceeds the auto threshold.
    const manualSegments: DocTableRow[][] = []
    let current: DocTableRow[] = []
    for (const row of block.rows) {
      if (row.splitBefore && current.length > 0) {
        manualSegments.push(current)
        current = []
      }
      current.push(row)
    }
    if (current.length > 0) manualSegments.push(current)

    const chunks: DocTableRow[][] = []
    for (const seg of manualSegments) {
      for (let i = 0; i < seg.length; i += ROWS_PER_PAGE) {
        chunks.push(seg.slice(i, i + ROWS_PER_PAGE))
      }
    }

    chunks.forEach((chunk, ci) => {
      if (ci === 0) {
        result.push(captionParagraph(`${s.tablePrefix} ${num} – ${block.caption}`, cfg))
      } else {
        result.push(emptyParagraph(cfg))
        result.push(captionParagraph(`Продовження таблиці ${num} – ${block.caption}`, cfg, AlignmentType.RIGHT))
      }
      result.push(new Table({
        rows: [makeHeaderRow(), ...chunk.map(makeDataRow)],
        width: tableWidth,
        columnWidths: colTwips,
      }))
    })
    result.push(emptyParagraph(cfg))

    return result
  }

  return []
}

const HF_ALIGN_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

// Build the runs for a header/footer paragraph based on its mode.
// The PAGE field is emitted as a SimpleField WITH a cached value (the page on
// which this header/footer first appears) so viewers that don't recompute fields
// (e.g. SuperDoc preview) still display the right number.
function hfRuns(hf: HeaderFooterConfig, cachedPage: number): (TextRun | SimpleField)[] {
  const size = ptToHalfPt(hf.fontSize)
  const font = hf.fontFamily
  const runs: (TextRun | SimpleField)[] = []
  const hasText = hf.mode === 'text' || hf.mode === 'textAndPage'
  const hasPage = hf.mode === 'pageNumber' || hf.mode === 'textAndPage'

  if (hasText && hf.text) {
    runs.push(new TextRun({ text: hf.text, font, size }))
  }
  if (hasText && hasPage && hf.text) {
    runs.push(new TextRun({ text: ' ', font, size }))
  }
  if (hasPage) {
    runs.push(new SimpleField('PAGE', String(cachedPage)))
  }
  return runs
}

function buildHeader(hf: HeaderFooterConfig, cachedPage: number): Header | undefined {
  if (hf.mode === 'none') return undefined
  const runs = hfRuns(hf, cachedPage)
  if (runs.length === 0) return undefined
  return new Header({
    children: [new Paragraph({ children: runs, alignment: HF_ALIGN_MAP[hf.align] ?? AlignmentType.RIGHT })],
  })
}

function buildFooter(hf: HeaderFooterConfig, cachedPage: number): Footer | undefined {
  if (hf.mode === 'none') return undefined
  const runs = hfRuns(hf, cachedPage)
  if (runs.length === 0) return undefined
  return new Footer({
    children: [new Paragraph({ children: runs, alignment: HF_ALIGN_MAP[hf.align] ?? AlignmentType.CENTER })],
  })
}

async function buildDocxBlob(doc: ReportDocument): Promise<Blob> {
  const s = doc.settings
  const cfg: FontConfig = {
    name: s.fontFamily,
    size: ptToHalfPt(s.fontSize),
    lineSpacing: s.lineSpacing,
    paragraphIndent: s.paragraphIndent,
  }

  const counters = makeCounters(s.numbering)

  // Pre-render all formulas to PNG (async). KaTeX→PNG works everywhere
  // (Word, OnlyOffice, preview), unlike OMML which OnlyOffice can't show.
  const formulaImages = new Map<string, FormulaImage>()
  for (const block of doc.blocks) {
    if (block.type === 'formula' && block.latex.trim()) {
      const img = await renderFormulaPng(block.latex, Math.round(s.fontSize * 1.6))
      if (img) formulaImages.set(block.id, img)
    }
  }

  const titleChildren = buildTitlePage(doc, cfg)
  const bodyChildren: BodyEl[] = []

  for (const block of doc.blocks) {
    const out: { inlineRef?: string } = {}
    const elements = buildBlock(block, doc, cfg, counters, out, formulaImages)

    // Inline reference: append the sentence to the previous paragraph instead of
    // emitting it on its own line. Falls back to a normal line if there's no
    // previous paragraph to attach to.
    if (out.inlineRef) {
      const prev = bodyChildren[bodyChildren.length - 1]
      if (prev instanceof Paragraph) {
        for (const run of inlineRuns(` ${out.inlineRef}`, cfg)) prev.addChildElement(run)
      } else {
        bodyChildren.push(bodyParagraph(inlineRuns(out.inlineRef, cfg), cfg))
      }
    }

    bodyChildren.push(...elements)
  }

  const startPage = s.pageNumberStart ?? 1
  // Title page shows startPage; the first body page is the next one (continuous).
  const bodyFirstPage = startPage + 1
  // Each section's PAGE field caches the number of the page it first appears on.
  const titleHeader = buildHeader(s.header, startPage)
  const titleFooter = buildFooter(s.footer, startPage)
  const bodyHeader = buildHeader(s.header, bodyFirstPage)
  const bodyFooter = buildFooter(s.footer, bodyFirstPage)

  const pageMargin = {
    left: cmToTwip(s.marginLeft),
    right: cmToTwip(s.marginRight),
    top: cmToTwip(s.marginTop),
    bottom: cmToTwip(s.marginBottom),
  }

  // Title page is its own section so the body starts on a fresh page WITHOUT
  // an extra empty paragraph. The body section uses nextPage to break cleanly.
  const docxDoc = new Document({
    // Ask the editor to recompute fields (TOC, page numbers) when the file opens.
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: cfg.name,
            size: cfg.size,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: pageMargin,
            // First page of the document carries the configured start number.
            pageNumbers: { start: startPage },
          },
        },
        // The title section has no header/footer when differentFirstPage is on.
        headers: titleHeader && !s.differentFirstPage ? { default: titleHeader } : undefined,
        footers: titleFooter && !s.differentFirstPage ? { default: titleFooter } : undefined,
        children: [...titleChildren],
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            // No pageNumbers.start here: numbering flows continuously from the
            // title page, so the first body page is startPage + 1.
            margin: pageMargin,
          },
        },
        headers: bodyHeader ? { default: bodyHeader } : undefined,
        footers: bodyFooter ? { default: bodyFooter } : undefined,
        children: [...bodyChildren],
      },
    ],
  })

  return Packer.toBlob(docxDoc)
}

export function useDocxExport() {
  async function exportToDocx(doc: ReportDocument): Promise<void> {
    const blob = await buildDocxBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.name.replace(/\s+/g, '_')}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function getPreviewBlob(doc: ReportDocument): Promise<Blob> {
    return buildDocxBlob(doc)
  }

  return { exportToDocx, getPreviewBlob }
}

// suppress unused warning for CM_TO_EMU — used conceptually for image dimensions
void CM_TO_EMU
void convertMillimetersToTwip
