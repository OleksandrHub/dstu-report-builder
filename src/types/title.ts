import type { ReportBlock } from './blocks'

export interface TitlePageData {
  ministry: string
  university: string
  department: string
  workType: string
  workNumber: string
  topic: string
  discipline: string
  studentGroup: string
  studentName: string
  teacherTitle: string
  teacherName: string
  city: string
  year: string
}

export interface WorkIntro {
  topic: string
  goal: string
  variant: string
}

export type TitleAlign = 'left' | 'center' | 'right'

export interface TitleLineBlock {
  id: string
  type: 'titleLine'
  text: string           // supports {{variables}}
  align: TitleAlign
  bold: boolean
  spaceBefore: boolean
  paddingLeft: number    // cm indent from left edge of content area
  paddingRight: number   // cm indent from right edge
  fontSize?: number
  lineSpacing?: number
  color?: string
}

export interface TitleSpacerBlock {
  id: string
  type: 'titleSpacer'
  lines: number // number of text lines (converted to cm using doc font settings)
}

// Wraps a regular body block so the title layout can use the full block toolbox,
// not just lines and spacers.
export interface TitleContentBlock {
  id: string
  type: 'titleContent'
  block: ReportBlock
}

export type TitleBlock = TitleLineBlock | TitleSpacerBlock | TitleContentBlock

export interface TitlePageTemplate {
  id: string
  name: string
  blocks: TitleBlock[]
}

export interface TitleDataTemplate {
  id: string
  name: string
  data: Partial<TitlePageData>
}

// lines × fontSize(pt) × lineSpacing × (2.54/72) = height in cm
export function spacerHeightCm(lines: number, fontSizePt: number, lineSpacing: number): number {
  return lines * fontSizePt * lineSpacing * (2.54 / 72)
}

// Available variables: {{ministry}}, {{university}}, {{department}}, {{workType}},
// {{workNumber}}, {{topic}}, {{discipline}}, {{studentGroup}}, {{studentName}},
// {{teacherTitle}}, {{teacherName}}, {{city}}, {{year}}
export function resolveTitleVars(text: string, data: TitlePageData): string {
  return text
    .replace(/\{\{ministry\}\}/g, data.ministry)
    .replace(/\{\{university\}\}/g, data.university)
    .replace(/\{\{department\}\}/g, data.department)
    .replace(/\{\{workType\}\}/g, data.workType)
    .replace(/\{\{workNumber\}\}/g, data.workNumber)
    .replace(/\{\{topic\}\}/g, data.topic)
    .replace(/\{\{discipline\}\}/g, data.discipline)
    .replace(/\{\{studentGroup\}\}/g, data.studentGroup)
    .replace(/\{\{studentName\}\}/g, data.studentName)
    .replace(/\{\{teacherTitle\}\}/g, data.teacherTitle)
    .replace(/\{\{teacherName\}\}/g, data.teacherName)
    .replace(/\{\{city\}\}/g, data.city)
    .replace(/\{\{year\}\}/g, data.year)
}
