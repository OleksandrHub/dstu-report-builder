import { Paragraph, TextRun, AlignmentType, Header, Footer, SimpleField } from 'docx'
import type { HeaderFooterConfig } from '../../types/document'
import { ptToHalfPt } from './units'

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

export function buildHeader(hf: HeaderFooterConfig, cachedPage: number): Header | undefined {
  if (hf.mode === 'none') return undefined
  const runs = hfRuns(hf, cachedPage)
  if (runs.length === 0) return undefined
  return new Header({
    children: [new Paragraph({ children: runs, alignment: HF_ALIGN_MAP[hf.align] ?? AlignmentType.RIGHT })],
  })
}

export function buildFooter(hf: HeaderFooterConfig, cachedPage: number): Footer | undefined {
  if (hf.mode === 'none') return undefined
  const runs = hfRuns(hf, cachedPage)
  if (runs.length === 0) return undefined
  return new Footer({
    children: [new Paragraph({ children: runs, alignment: HF_ALIGN_MAP[hf.align] ?? AlignmentType.CENTER })],
  })
}
