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
  PageNumber,
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

function baseRun(text: string, cfg: FontConfig, bold = false, italic = false): TextRun {
  return new TextRun({
    text,
    font: cfg.name,
    size: cfg.size,
    bold,
    italics: italic,
  })
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
    children: [baseRun(text, cfg, false)],
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
        children: [baseRun(resolved, cfg, line.bold)],
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
  counters: { image: number; code: number; table: number }
): (Paragraph | Table)[] {
  const s = doc.settings

  if (block.type === 'paragraph') {
    const pCfg = { ...cfg }
    if (block.fontSize) pCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) pCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) pCfg.lineSpacing = block.lineSpacing

    const alignMap: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED,
    }
    const alignment = alignMap[block.align ?? 'justify'] ?? AlignmentType.JUSTIFIED
    const noIndent = block.align === 'center' || block.align === 'right'

    return [bodyParagraph([baseRun(block.text, pCfg, block.bold ?? false)], pCfg, noIndent, alignment)]
  }

  if (block.type === 'heading') {
    const levelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }
    return [
      new Paragraph({
        children: [baseRun(block.text, cfg, true)],
        heading: levelMap[block.level],
        alignment: AlignmentType.CENTER,
        spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
      }),
    ]
  }

  if (block.type === 'list') {
    const result: Paragraph[] = []

    if (block.introText) {
      result.push(bodyParagraph([baseRun(block.introText, cfg)], cfg))
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
            children: [baseRun(`${idx + 1}. ${text}`, cfg)],
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
            children: [baseRun(`– ${text}`, cfg)],
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
      result.push(bodyParagraph([baseRun(refText, cfg)], cfg))
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
      result.push(bodyParagraph([baseRun(refText, cfg)], cfg))
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
        children: [baseRun(`${s.imagePrefix} ${counters.image} – ${block.caption}`, cfg)],
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
      result.push(bodyParagraph([baseRun(refText, cfg)], cfg))
    }
    result.push(emptyParagraph(cfg))

    const makeBorder = () => ({
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    })

    const makeHeaderRow = () => new TableRow({
      children: block.headers.map(h =>
        new TableCell({
          children: [new Paragraph({ children: [baseRun(h, tCfg, true)], alignment: AlignmentType.CENTER, spacing: { line: Math.round(tblSpacing * 240), lineRule: 'auto' as never } })],
          borders: makeBorder(),
        })
      ),
      tableHeader: true,
    })

    const makeDataRow = (row: DocTableRow) => new TableRow({
      children: row.cells.map(cell =>
        new TableCell({
          children: [new Paragraph({ children: [baseRun(cell.text, tCfg)], spacing: { line: Math.round(tblSpacing * 240), lineRule: 'auto' as never } })],
          borders: makeBorder(),
        })
      ),
    })

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
        width: { size: 100, type: WidthType.PERCENTAGE },
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
function hfRuns(hf: HeaderFooterConfig): (TextRun)[] {
  const size = ptToHalfPt(hf.fontSize)
  const font = hf.fontFamily
  const runs: TextRun[] = []
  const hasText = hf.mode === 'text' || hf.mode === 'textAndPage'
  const hasPage = hf.mode === 'pageNumber' || hf.mode === 'textAndPage'

  if (hasText && hf.text) {
    runs.push(new TextRun({ text: hf.text, font, size }))
  }
  if (hasText && hasPage && hf.text) {
    runs.push(new TextRun({ text: ' ', font, size }))
  }
  if (hasPage) {
    runs.push(new TextRun({ children: [PageNumber.CURRENT], font, size }))
  }
  return runs
}

function buildHeader(hf: HeaderFooterConfig): Header | undefined {
  if (hf.mode === 'none') return undefined
  const runs = hfRuns(hf)
  if (runs.length === 0) return undefined
  return new Header({
    children: [new Paragraph({ children: runs, alignment: HF_ALIGN_MAP[hf.align] ?? AlignmentType.RIGHT })],
  })
}

function buildFooter(hf: HeaderFooterConfig): Footer | undefined {
  if (hf.mode === 'none') return undefined
  const runs = hfRuns(hf)
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
    const elements = buildBlock(block, doc, cfg, counters)
    bodyChildren.push(...elements)
  }

  const header = buildHeader(s.header)
  const footer = buildFooter(s.footer)

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
            margin: {
              left: cmToTwip(s.marginLeft),
              right: cmToTwip(s.marginRight),
              top: cmToTwip(s.marginTop),
              bottom: cmToTwip(s.marginBottom),
            },
          },
          // When enabled, the title page gets its own (empty) header/footer
          // so page numbering effectively starts on the body.
          titlePage: s.differentFirstPage,
        },
        headers: header
          ? {
              default: header,
              ...(s.differentFirstPage
                ? { first: new Header({ children: [new Paragraph({ children: [] })] }) }
                : {}),
            }
          : undefined,
        footers: footer
          ? {
              default: footer,
              ...(s.differentFirstPage
                ? { first: new Footer({ children: [new Paragraph({ children: [] })] }) }
                : {}),
            }
          : undefined,
        children: [
          ...titleChildren,
          new Paragraph({ children: [], pageBreakBefore: true }),
          ...bodyChildren,
        ],
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
