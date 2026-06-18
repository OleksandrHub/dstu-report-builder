import {
  Paragraph,
  TextRun,
  AlignmentType,
  ImageRun,
  Math as DocMath,
  MathRun,
  TabStopType,
} from 'docx'
import type { FontConfig } from './text-runs'
import { latexToMath } from './latex-math'
import { dataUrlToBytes } from './units'
import type { FormulaImage } from '../useFormulaImage'

export function buildFormulaParagraph(
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
