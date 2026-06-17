export interface DocumentSettings {
  fontFamily: string
  fontSize: number // pt
  lineSpacing: number
  paragraphIndent: number // cm
  marginLeft: number // cm
  marginRight: number // cm
  marginTop: number // cm
  marginBottom: number // cm
  imagePrefix: string
  listingPrefix: string
  tablePrefix: string
}

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

export interface ParagraphBlock {
  id: string
  type: 'paragraph'
  text: string
}

export interface HeadingBlock {
  id: string
  type: 'heading'
  text: string
  level: 1 | 2 | 3
}

export interface ListItem {
  id: string
  text: string
}

export interface ListBlock {
  id: string
  type: 'list'
  ordered: boolean
  items: ListItem[]
  introText?: string
}

export interface CodeBlock {
  id: string
  type: 'code'
  caption: string
  code: string
  language: string
  referenceText?: string
}

export interface ImageBlock {
  id: string
  type: 'image'
  src: string
  caption: string
  referenceText?: string
}

export interface TableCell {
  text: string
  isHeader?: boolean
  colspan?: number
  rowspan?: number
}

export interface TableRow {
  id: string
  cells: TableCell[]
}

export interface TableBlock {
  id: string
  type: 'table'
  caption: string
  headers: string[]
  rows: TableRow[]
  referenceText?: string
}

export interface WorkIntro {
  topic: string
  goal: string
  variant: string
}

export type ReportBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | TableBlock

// ===== Title page block system =====

export type TitleAlign = 'left' | 'center' | 'right'

export interface TitleLineBlock {
  id: string
  type: 'titleLine'
  text: string           // supports {{variables}}
  align: TitleAlign
  bold: boolean
  spaceBefore: boolean   // add extra vertical space before this line
  paddingLeft: number    // cm indent from left edge of content area
  paddingRight: number   // cm indent from right edge
}

export interface TitleSpacerBlock {
  id: string
  type: 'titleSpacer'
  lines: number          // number of text lines (converted to cm using doc font settings)
}

// lines × fontSize(pt) × lineSpacing × (2.54/72) = height in cm
export function spacerHeightCm(lines: number, fontSizePt: number, lineSpacing: number): number {
  return lines * fontSizePt * lineSpacing * (2.54 / 72)
}

export type TitleBlock = TitleLineBlock | TitleSpacerBlock

export interface TitlePageTemplate {
  id: string
  name: string
  blocks: TitleBlock[]
}

// Variables available in title templates: {{ministry}}, {{university}}, {{department}},
// {{workType}}, {{workNumber}}, {{topic}}, {{discipline}},
// {{studentGroup}}, {{studentName}}, {{teacherTitle}}, {{teacherName}}, {{city}}, {{year}}

export interface ReportDocument {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  titlePage: TitlePageData
  titleTemplate: TitleBlock[]   // the active title layout
  intro: WorkIntro
  settings: DocumentSettings
  blocks: ReportBlock[]
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  fontFamily: 'Times New Roman',
  fontSize: 14,
  lineSpacing: 1.5,
  paragraphIndent: 1.25,
  marginLeft: 3.0,
  marginRight: 1.5,
  marginTop: 2.0,
  marginBottom: 2.0,
  imagePrefix: 'Рисунок',
  listingPrefix: 'Лістинг',
  tablePrefix: 'Таблиця',
}

export const DEFAULT_TITLE_PAGE: TitlePageData = {
  ministry: 'Міністерство освіти і науки України',
  university: 'Тернопільський національний технічний університет імені Івана Пулюя',
  department: 'Кафедра комп\'ютерних наук',
  workType: 'лабораторної роботи',
  workNumber: '1',
  topic: 'Тема роботи',
  discipline: 'Дисципліна',
  studentGroup: 'ХХ-11',
  studentName: 'Прізвище І. П.',
  teacherTitle: 'PhD',
  teacherName: 'Прізвище І. П.',
  city: 'Тернопіль',
  year: new Date().getFullYear().toString(),
}

export const DEFAULT_INTRO: WorkIntro = {
  topic: 'Тема роботи',
  goal: 'Мета роботи',
  variant: '1',
}

function tid() {
  return Math.random().toString(36).slice(2)
}

function line(text: string, align: TitleAlign, bold = false, paddingLeft = 0, paddingRight = 0): TitleLineBlock {
  return { id: tid(), type: 'titleLine', text, align, bold, spaceBefore: false, paddingLeft, paddingRight }
}

export const DEFAULT_TITLE_TEMPLATE: TitleBlock[] = [
  line('{{ministry}}', 'center'),
  line('{{university}}', 'center'),
  line('{{department}}', 'center'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('ЗВІТ', 'center', true),
  line('про виконання {{workType}} №{{workNumber}}', 'center'),
  line('на тему: «{{topic}}»', 'center'),
  line('з дисципліни «{{discipline}}»', 'center'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('Виконав: Студент групи {{studentGroup}}', 'left', false, 9, 0),
  line('{{studentName}}', 'left', false, 9, 0),
  line('Прийняв: {{teacherTitle}}', 'left', false, 9, 0),
  line('{{teacherName}}', 'left', false, 9, 0),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('{{city}} – {{year}}', 'center'),
]

export const TITLE_TEMPLATES_STORAGE_KEY = 'dstu-title-templates'

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
