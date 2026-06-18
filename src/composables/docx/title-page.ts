import { Paragraph, TextRun, AlignmentType } from 'docx'
import type { ReportDocument, TitleLineBlock, TitleSpacerBlock } from '../../types/document'
import { resolveTitleVars } from '../../types/document'
import type { FormulaImage } from '../useFormulaImage'
import { cmToTwip, ptToHalfPt } from './units'
import type { FontConfig } from './text-runs'
import { inlineRuns } from './text-runs'
import { ALIGN_MAP } from './paragraphs'
import type { Counters } from './counters'
import type { BodyEl } from './blocks'
import { buildBlock } from './blocks'

export function buildTitlePage(
  doc: ReportDocument,
  cfg: FontConfig,
  counters: Counters,
  previewMode: boolean,
  formulaImages: Map<string, FormulaImage>,
): BodyEl[] {
  const result: BodyEl[] = []

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
    } else if (block.type === 'titleContent') {
      // A full body block embedded in the title layout.
      result.push(...buildBlock(block.block, doc, cfg, counters, previewMode, {}, formulaImages))
    } else {
      const line = block as TitleLineBlock
      const resolved = resolveTitleVars(line.text, doc.titlePage)
      const lCfg = { ...cfg }
      if (line.fontSize) lCfg.size = ptToHalfPt(line.fontSize)
      if (line.lineSpacing !== undefined) lCfg.lineSpacing = line.lineSpacing
      if (line.color) lCfg.color = line.color
      result.push(new Paragraph({
        children: inlineRuns(resolved, lCfg, line.bold),
        alignment: ALIGN_MAP[line.align] ?? AlignmentType.LEFT,
        spacing: { line: Math.round(lCfg.lineSpacing * 240), lineRule: 'auto' as never },
        indent: {
          left: line.paddingLeft ? cmToTwip(line.paddingLeft) : undefined,
          right: line.paddingRight ? cmToTwip(line.paddingRight) : undefined,
        },
      }))
    }
  }

  return result
}
