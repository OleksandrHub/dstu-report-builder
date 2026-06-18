export type HeaderFooterMode = 'none' | 'text' | 'pageNumber' | 'textAndPage'
export type HeaderFooterAlign = 'left' | 'center' | 'right'

export interface HeaderFooterConfig {
  mode: HeaderFooterMode
  text: string          // used when mode is 'text' or 'textAndPage'
  align: HeaderFooterAlign
  fontSize: number      // pt
  fontFamily: string
}

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
  header: HeaderFooterConfig
  footer: HeaderFooterConfig
  differentFirstPage: boolean // title page gets a separate (empty) header/footer
  pageNumberStart: number // number assigned to the very first (title) page
  numberingScheme: NumberingScheme // how figures/tables/listings/formulas are numbered
  formulaPrefix: string
}

// 'plain'      → 1, 2, 3 (continuous, ignores sections)
// 'perSection' → 1.1, 1.2, 1.3 (resets per H2 section but does NOT renumber chapters)
// 'sectioned'  → 1.1, 1.2 … 2.1 (H2 = chapter N, item = N.k)
export type NumberingScheme = 'plain' | 'perSection' | 'sectioned'

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
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number   // pt, overrides doc default
  fontFamily?: string // overrides doc default
  lineSpacing?: number // overrides doc default
  indent?: number     // cm, first-line indent override (overrides doc default)
  color?: string      // hex without '#', e.g. 'FF0000'
}

export interface HeadingBlock {
  id: string
  type: 'heading'
  text: string
  level: 1 | 2 | 3
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  indent?: number     // cm, first-line indent
  color?: string      // hex without '#'
}

export interface PageBreakBlock {
  id: string
  type: 'pageBreak'
}

export interface SpacerBlock {
  id: string
  type: 'spacer'
  lines?: number // number of empty lines (default 1)
}

export interface TocBlock {
  id: string
  type: 'toc'
  title?: string // heading shown above the table of contents (default "Зміст")
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
  inlineReference?: boolean // append referenceText to the previous paragraph instead of a new line
  fontSize?: number     // default 12
  lineSpacing?: number  // default 1.0
}

export interface ImageBlock {
  id: string
  type: 'image'
  src: string
  caption: string
  referenceText?: string
  inlineReference?: boolean
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
  splitBefore?: boolean // start a manual "continuation table" before this row
}

export interface TableBlock {
  id: string
  type: 'table'
  caption: string
  headers: string[]
  rows: TableRow[]
  referenceText?: string
  inlineReference?: boolean
  fontSize?: number     // default 12
  lineSpacing?: number  // default 1.0
  fullWidth?: boolean       // stretch table to the full content width (default true)
  columnWidths?: number[]   // relative width per column in % (must sum ~100); empty = auto/equal
}

export interface WorkIntro {
  topic: string
  goal: string
  variant: string
}

export interface ParsedMarkdownTable {
  headers: string[]
  rows: string[][]
}

// Parse a GitHub-flavored Markdown table into headers + rows.
// Accepts optional leading/trailing pipes; the separator row (---|:--:) is skipped.
// Returns null if the text doesn't look like a table.
export function parseMarkdownTable(md: string): ParsedMarkdownTable | null {
  const splitRow = (line: string): string[] => {
    let s = line.trim()
    if (s.startsWith('|')) s = s.slice(1)
    if (s.endsWith('|')) s = s.slice(0, -1)
    // Split on unescaped pipes, then unescape \| back to |.
    return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim())
  }
  const isSeparator = (line: string): boolean =>
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)

  const lines = md.split(/\r?\n/).map(l => l.trim()).filter(l => l.includes('|'))
  if (lines.length < 1) return null

  const headerLine = lines[0]!
  let bodyStart = 1
  // If the second line is a separator, the first is the header. Otherwise treat
  // the first line as header and everything after as body (no separator).
  if (lines.length >= 2 && isSeparator(lines[1]!)) {
    bodyStart = 2
  }

  const headers = splitRow(headerLine)
  if (headers.length === 0) return null

  const rows: string[][] = []
  for (let i = bodyStart; i < lines.length; i++) {
    if (isSeparator(lines[i]!)) continue
    const cells = splitRow(lines[i]!)
    // Normalize to the header column count.
    while (cells.length < headers.length) cells.push('')
    rows.push(cells.slice(0, headers.length))
  }
  return { headers, rows }
}

export interface FormulaBlock {
  id: string
  type: 'formula'
  latex: string
  caption?: string          // optional caption like a listing
  referenceText?: string    // optional in-text reference ("...у формулі {no}.")
  inlineReference?: boolean
  numbered?: boolean         // show equation number on the right (default true)
}

export type ReportBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | TableBlock
  | FormulaBlock
  | PageBreakBlock
  | SpacerBlock
  | TocBlock

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

export interface TitleDataTemplate {
  id: string
  name: string
  data: Partial<TitlePageData>
}

export const TITLE_DATA_TEMPLATES_KEY = 'dstu-title-data-templates'

// Variables available in title templates: {{ministry}}, {{university}}, {{department}},
// {{workType}}, {{workNumber}}, {{topic}}, {{discipline}},
// {{studentGroup}}, {{studentName}}, {{teacherTitle}}, {{teacherName}}, {{city}}, {{year}}

export interface ReportDocument {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  titlePage: TitlePageData
  titleTemplate: TitleBlock[]
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
  header: { mode: 'none', text: '', align: 'right', fontSize: 12, fontFamily: 'Times New Roman' },
  footer: { mode: 'pageNumber', text: '', align: 'center', fontSize: 12, fontFamily: 'Times New Roman' },
  differentFirstPage: true,
  pageNumberStart: 1,
  numberingScheme: 'plain',
  formulaPrefix: 'Формула',
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
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('{{department}}', 'right'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('ЗВІТ', 'center', true),
  line('про виконання {{workType}} №{{workNumber}}', 'center'),
  line('на тему: «{{topic}}»', 'center'),
  line('з дисципліни «{{discipline}}»', 'center'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('Виконав:', 'left', true, 11, 0),
  line('Студент групи {{studentGroup}}', 'left', false, 11, 0),
  line('{{studentName}}', 'left', false, 11, 0),
  line('Прийняв:', 'left', true, 11, 0),
  line('{{teacherTitle}}', 'left', false, 11, 0),
  line('{{teacherName}}', 'left', false, 11, 0),
  { id: tid(), type: 'titleSpacer', lines: 5 },
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
