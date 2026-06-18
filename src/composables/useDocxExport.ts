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
  Header,
  Footer,
  SimpleField,
  SectionType,
  convertInchesToTwip,
  convertMillimetersToTwip,
} from 'docx'
import type { ReportDocument, ReportBlock, ListItem, TitleLineBlock, TitleSpacerBlock, TableRow as DocTableRow, HeaderFooterConfig } from '../types/document'
import { resolveTitleVars } from '../types/document'

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
  return new Paragraph({
    children: inlineRuns(text, cfg),
    alignment: align,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
  })
}

const ALIGN_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

// Build the in-text reference sentence for a numbered object (code/image/table).
// If the user's text contains the {no} placeholder, only substitute the number
// (no auto prefix). Otherwise fall back to the legacy "<text> <prefix> <n>." format.
function resolveReference(text: string | undefined, prefix: string, num: number): string {
  if (!text) return ''
  if (text.includes('{no}')) {
    return text.replace(/\{no\}/g, String(num))
  }
  return `${text} ${prefix.toLowerCase()} ${num}.`
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


function buildBlock(
  block: ReportBlock,
  doc: ReportDocument,
  cfg: FontConfig,
  counters: { image: number; code: number; table: number },
  out: { inlineRef?: string } = {}
): (Paragraph | Table)[] {
  const s = doc.settings

  if (block.type === 'paragraph') {
    const pCfg = { ...cfg }
    if (block.fontSize) pCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) pCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) pCfg.lineSpacing = block.lineSpacing
    if (block.indent !== undefined) pCfg.paragraphIndent = block.indent

    const alignMap: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED,
    }
    const alignment = alignMap[block.align ?? 'justify'] ?? AlignmentType.JUSTIFIED
    const noIndent = block.align === 'center' || block.align === 'right'

    return [bodyParagraph(inlineRuns(block.text, pCfg, block.bold ?? false), pCfg, noIndent, alignment)]
  }

  if (block.type === 'heading') {
    const levelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }
    return [
      new Paragraph({
        children: inlineRuns(block.text, cfg, true),
        heading: levelMap[block.level],
        alignment: AlignmentType.CENTER,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
      }),
    ]
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
    counters.code++
    const result: (Paragraph | Table)[] = []
    const codeSize = ptToHalfPt(block.fontSize ?? 12)
    const codeSpacing = block.lineSpacing ?? 1.0

    const refText = resolveReference(block.referenceText, s.listingPrefix, counters.code)

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))
    result.push(captionParagraph(`${s.listingPrefix} ${counters.code} – ${block.caption}`, cfg))
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
    counters.image++
    const result: (Paragraph | Table)[] = []

    const refText = resolveReference(block.referenceText, s.imagePrefix, counters.image)

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
        children: inlineRuns(`${s.imagePrefix} ${counters.image} – ${block.caption}`, cfg),
        alignment: AlignmentType.CENTER,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
      })
    )
    result.push(emptyParagraph(cfg))

    return result
  }

  if (block.type === 'table') {
    counters.table++
    const result: (Paragraph | Table)[] = []
    const tblSize = ptToHalfPt(block.fontSize ?? 12)
    const tblSpacing = block.lineSpacing ?? 1.0
    const tCfg = { ...cfg, size: tblSize, lineSpacing: tblSpacing }
    const ROWS_PER_PAGE = 20 // split threshold

    const refText = block.referenceText
      ? (block.referenceText.includes('{no}')
          ? block.referenceText.replace(/\{no\}/g, String(counters.table))
          : `У ${s.tablePrefix.toLowerCase()} ${counters.table} ${block.referenceText.toLowerCase()}.`)
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
        result.push(captionParagraph(`${s.tablePrefix} ${counters.table} – ${block.caption}`, cfg))
      } else {
        result.push(emptyParagraph(cfg))
        result.push(captionParagraph(`Продовження таблиці ${counters.table} – ${block.caption}`, cfg, AlignmentType.RIGHT))
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

  const counters = { image: 0, code: 0, table: 0 }

  const titleChildren = buildTitlePage(doc, cfg)
  const bodyChildren: (Paragraph | Table)[] = []

  for (const block of doc.blocks) {
    const out: { inlineRef?: string } = {}
    const elements = buildBlock(block, doc, cfg, counters, out)

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
