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
  convertInchesToTwip,
  convertMillimetersToTwip,
} from 'docx'
import type { ReportDocument, ReportBlock, ListItem } from '../types/document'

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

function bodyParagraph(runs: TextRun[], cfg: FontConfig, noIndent = false): Paragraph {
  return new Paragraph({
    children: runs,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    indent: noIndent ? undefined : { firstLine: cmToTwip(cfg.paragraphIndent) },
  })
}

function captionParagraph(text: string, cfg: FontConfig, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT): Paragraph {
  return new Paragraph({
    children: [baseRun(text, cfg, false)],
    alignment: align,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
  })
}

function buildTitlePage(doc: ReportDocument, cfg: FontConfig): Paragraph[] {
  const { titlePage: t } = doc
  const center = AlignmentType.CENTER
  const right = AlignmentType.RIGHT

  const centered = (text: string, bold = false) =>
    new Paragraph({
      children: [baseRun(text, cfg, bold)],
      alignment: center,
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    })

  const rightAligned = (text: string) =>
    new Paragraph({
      children: [baseRun(text, cfg)],
      alignment: right,
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    })

  const blank = () =>
    new Paragraph({ children: [new TextRun('')], spacing: { before: 200, after: 200 } })

  return [
    centered(t.ministry),
    centered(t.university),
    centered(t.department),
    blank(), blank(), blank(), blank(),
    centered('ЗВІТ', true),
    centered(`про виконання ${t.workType} №${t.workNumber}`),
    centered(`на тему: «${t.topic}»`),
    centered(`з дисципліни «${t.discipline}»`),
    blank(), blank(), blank(), blank(),
    rightAligned(`Виконав: Студент групи ${t.studentGroup}`),
    rightAligned(t.studentName),
    rightAligned(`Прийняв: ${t.teacherTitle}`),
    rightAligned(t.teacherName),
    blank(), blank(), blank(), blank(),
    centered(`${t.city} – ${t.year}`),
  ]
}

function buildIntro(doc: ReportDocument, cfg: FontConfig): Paragraph[] {
  const { intro } = doc
  return [
    new Paragraph({
      children: [baseRun(`Тема: ${intro.topic}.`, cfg)],
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    }),
    new Paragraph({
      children: [baseRun(`Мета: ${intro.goal}.`, cfg)],
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    }),
    new Paragraph({
      children: [baseRun(`Варіант №${intro.variant}`, cfg)],
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    }),
    new Paragraph({
      children: [baseRun('Виконання роботи:', cfg, true)],
      spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    }),
  ]
}

function buildBlock(
  block: ReportBlock,
  doc: ReportDocument,
  cfg: FontConfig,
  counters: { image: number; code: number; table: number }
): (Paragraph | Table)[] {
  const s = doc.settings

  if (block.type === 'paragraph') {
    return [bodyParagraph([baseRun(block.text, cfg)], cfg)]
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

    const refText = block.referenceText
      ? `${block.referenceText} ${s.listingPrefix.toLowerCase()} ${counters.code}.`
      : ''

    if (refText) {
      result.push(bodyParagraph([baseRun(refText, cfg)], cfg))
    }

    result.push(
      captionParagraph(`${s.listingPrefix} ${counters.code} – ${block.caption}`, cfg)
    )

    result.push(
      new Paragraph({
        children: [
          new TextRun({
            text: block.code,
            font: 'Courier New',
            size: cfg.size,
          }),
        ],
        spacing: { line: 240, lineRule: 'auto' as never },
      })
    )

    return result
  }

  if (block.type === 'image') {
    counters.image++
    const result: (Paragraph | Table)[] = []

    const refText = block.referenceText
      ? `${block.referenceText} ${s.imagePrefix.toLowerCase()} ${counters.image}.`
      : ''

    if (refText) {
      result.push(bodyParagraph([baseRun(refText, cfg)], cfg))
    }

    if (block.src && block.src.startsWith('data:')) {
      try {
        const base64 = block.src.split(',')[1] ?? ''
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

        result.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: bytes,
                transformation: { width: 400, height: 300 },
                type: 'png',
              }),
            ],
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

    return result
  }

  if (block.type === 'table') {
    counters.table++
    const result: (Paragraph | Table)[] = []

    const refText = block.referenceText
      ? `У ${s.tablePrefix.toLowerCase()} ${counters.table} ${block.referenceText.toLowerCase()}.`
      : ''

    if (refText) {
      result.push(bodyParagraph([baseRun(refText, cfg)], cfg))
    }

    result.push(
      captionParagraph(`${s.tablePrefix} ${counters.table} – ${block.caption}`, cfg)
    )

    const headerRow = new TableRow({
      children: block.headers.map(h =>
        new TableCell({
          children: [
            new Paragraph({
              children: [baseRun(h, cfg, true)],
              alignment: AlignmentType.CENTER,
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
      ),
      tableHeader: true,
    })

    const dataRows = block.rows.map(
      (row) =>
        new TableRow({
          children: row.cells.map(cell =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [baseRun(cell.text, cfg)],
                }),
              ],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              },
            })
          ),
        })
    )

    result.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    )

    return result
  }

  return []
}

export function useDocxExport() {
  async function exportToDocx(doc: ReportDocument): Promise<void> {
    const s = doc.settings
    const cfg: FontConfig = {
      name: s.fontFamily,
      size: ptToHalfPt(s.fontSize),
      lineSpacing: s.lineSpacing,
      paragraphIndent: s.paragraphIndent,
    }

    const counters = { image: 0, code: 0, table: 0 }

    const titleChildren = buildTitlePage(doc, cfg)
    const introChildren = buildIntro(doc, cfg)
    const bodyChildren: (Paragraph | Table)[] = []

    for (const block of doc.blocks) {
      const elements = buildBlock(block, doc, cfg, counters)
      bodyChildren.push(...elements)
    }

    const docxDoc = new Document({
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
          },
          children: [
            ...titleChildren,
            new Paragraph({ children: [], pageBreakBefore: true }),
            ...introChildren,
            ...bodyChildren,
          ],
        },
      ],
    })

    const blob = await Packer.toBlob(docxDoc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.name.replace(/\s+/g, '_')}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToDocx }
}

// suppress unused warning for CM_TO_EMU — used conceptually for image dimensions
void CM_TO_EMU
void convertMillimetersToTwip
