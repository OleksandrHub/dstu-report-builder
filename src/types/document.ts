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
  numbering: NumberingSchemes // per-type numbering schemes
  formulaPrefix: string
}

// 'plain'      → 1, 2, 3 (continuous, ignores sections)
// 'perSection' → 1.1, 1.2, 1.3 (chapter fixed at 1, item runs continuously)
// 'sectioned'  → 1.1, 1.2 … 2.1 (H2 = chapter N, item = N.k)
export type NumberingScheme = 'plain' | 'perSection' | 'sectioned'

// Each numbered object type can use its own scheme.
export interface NumberingSchemes {
  image: NumberingScheme
  table: NumberingScheme
  code: NumberingScheme
  formula: NumberingScheme
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
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number   // pt, overrides doc default
  fontFamily?: string // overrides doc default
  lineSpacing?: number // overrides doc default
  indent?: number     // cm, first-line indent override (overrides doc default)
  color?: string      // hex without '#', e.g. 'FF0000'
}

// Inline text: appended to the end of the previous paragraph (no new line),
// supports the same inline markers as a paragraph.
export interface TextBlock {
  id: string
  type: 'text'
  text: string
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
  // Formatting — applies to the "Зміст" title AND the generated entry lines
  // (entries via Word's TOC1–TOC3 paragraph styles).
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number    // pt
  fontFamily?: string
  lineSpacing?: number
  color?: string       // hex without '#'
}

export interface ListItem {
  id: string
  text: string
  children?: ListItem[] // nested sub-list
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
  noTrailingSpace?: boolean // omit the empty line after the block
}

export interface ImageBlock {
  id: string
  type: 'image'
  src: string
  caption: string
  referenceText?: string
  inlineReference?: boolean
  noTrailingSpace?: boolean
  width?: number   // px (display width); height scales proportionally if height unset
  height?: number  // px
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
  noTrailingSpace?: boolean // omit the empty line after the block
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
  noTrailingSpace?: boolean  // omit the empty line after the block
}

export type SourceType = 'book' | 'article' | 'electronic'

export interface SourceEntry {
  id: string
  type: SourceType
  authors: string      // автори через кому: "Прізвище І. П., Інший А. Б."
  title: string        // основна назва праці
  subtitle?: string    // підзаголовок (після " : ")
  responsibility?: string // відомості про відповідальність після "/" (напр. "за ред. І. П. Прізвища")
  city: string         // місто видання
  publisher: string    // видавництво (для книги)
  year: string
  pages: string        // "256 с." для книги; "С. 12–20." для статті
  journal: string      // назва журналу/збірника (для статті)
  volume?: string      // том (для статті), напр. "12"
  issue?: string       // номер/випуск (для статті), напр. "3"
  isbn?: string        // ISBN (для книги)
  doi?: string         // DOI (стаття/електронний)
  url: string          // для електронного ресурсу
  resourceType?: string // тип електронного ресурсу, напр. "Веб-сайт" (default)
  accessDate: string   // дата звернення (для електронного ресурсу)
}

export interface SourcesBlock {
  id: string
  type: 'sources'
  title?: string       // heading shown above the list (default "Список використаних джерел")
  entries: SourceEntry[]
  // Formatting — applies to the heading AND every source entry line.
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number    // pt
  fontFamily?: string
  lineSpacing?: number
  color?: string       // hex without '#'
}

export interface DocColumn {
  id: string
  width: number         // relative width in % (columns should sum ~100)
  blocks: ReportBlock[] // nested blocks rendered in this column
}

export interface ColumnsBlock {
  id: string
  type: 'columns'
  columns: DocColumn[]
}

export type ReportBlock =
  | ParagraphBlock
  | TextBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | TableBlock
  | FormulaBlock
  | PageBreakBlock
  | SpacerBlock
  | TocBlock
  | SourcesBlock
  | ColumnsBlock

// Split a comma-separated authors string into individual names.
function splitAuthors(raw: string): string[] {
  return raw.split(',').map(a => a.trim()).filter(Boolean)
}

// Ensure a string ends with a sentence-final period (ignoring a trailing ")" or
// existing punctuation), used between ДСТУ description zones.
function dot(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return /[.!?]$/.test(t) ? t : t + '.'
}

// Format the title zone: "Назва : підзаголовок / відомості про відповідальність".
function titleZone(e: SourceEntry, authors: string[]): string {
  let zone = e.title.trim()
  if (e.subtitle?.trim()) zone += ` : ${e.subtitle.trim()}`

  // Responsibility (after "/"). Default rule per ДСТУ 8302:
  //   1 author      → first goes in the heading; no "/ ..." needed.
  //   2–3 authors    → list all after "/".
  //   4+ authors     → "/ <first> та ін.".
  // An explicit responsibility (e.g. "за ред. ...") overrides the auto rule.
  const resp = e.responsibility?.trim()
  if (resp) {
    zone += ` / ${resp}`
  } else if (authors.length >= 2 && authors.length <= 3) {
    zone += ` / ${authors.join(', ')}`
  } else if (authors.length >= 4) {
    zone += ` / ${authors[0]} та ін.`
  }
  return zone
}

// Format one source entry per ДСТУ 8302:2015.
export function formatSourceDSTU(e: SourceEntry): string {
  const dash = '–'
  const parts: string[] = []
  const authors = splitAuthors(e.authors)

  // Heading: the FIRST author leads the reference (when there is exactly one
  // author, or as the lead for multi-author works). Title-led entries (no
  // authors) start with the title.
  const heading = authors.length === 1 ? authors[0]!.trim() : (authors[0]?.trim() ?? '')
  if (heading) parts.push(dot(heading))

  const titlePart = titleZone(e, authors)
  if (titlePart) parts.push(dot(titlePart))

  if (e.type === 'book') {
    // Місто : Видавництво, рік. Обсяг. ISBN.
    const imprint = [e.city.trim(), e.publisher.trim()].filter(Boolean).join(' : ')
    const tail = [imprint, e.year.trim()].filter(Boolean).join(', ')
    if (tail) parts.push(dot(tail))
    if (e.pages.trim()) parts.push(dot(e.pages.trim()))
    if (e.isbn?.trim()) parts.push(dot(`ISBN ${e.isbn.trim().replace(/^ISBN\s*/i, '')}`))
  } else if (e.type === 'article') {
    // Назва журналу. Рік. Том, № N. С. 12–20. DOI.
    if (e.journal.trim()) parts.push(dot(e.journal.trim()))
    if (e.year.trim()) parts.push(dot(e.year.trim()))
    const vol = e.volume?.trim() ? `Т. ${e.volume.trim()}` : ''
    const iss = e.issue?.trim() ? `№ ${e.issue.trim().replace(/^№\s*/, '')}` : ''
    const volIss = [vol, iss].filter(Boolean).join(', ')
    if (volIss) parts.push(dot(volIss))
    if (e.pages.trim()) parts.push(dot(e.pages.trim()))
    if (e.doi?.trim()) parts.push(dot(`DOI: ${e.doi.trim().replace(/^DOI:?\s*/i, '')}`))
  } else {
    // Електронний ресурс: [Тип ресурсу.] URL: ... (дата звернення: ...).
    const rtype = e.resourceType?.trim() || 'Веб-сайт'
    parts.push(dot(rtype))
    if (e.doi?.trim()) parts.push(dot(`DOI: ${e.doi.trim().replace(/^DOI:?\s*/i, '')}`))
    if (e.url.trim()) {
      const acc = e.accessDate.trim() ? ` (дата звернення: ${e.accessDate.trim()}).` : ''
      parts.push(`URL: ${e.url.trim()}${acc}`)
    }
  }
  return parts.join(' ').replace(/—/g, dash)
}

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
  fontSize?: number      // pt, overrides doc default
  lineSpacing?: number   // overrides doc default
  color?: string         // hex without '#'
}

export interface TitleSpacerBlock {
  id: string
  type: 'titleSpacer'
  lines: number          // number of text lines (converted to cm using doc font settings)
}

// Wraps any regular body block (paragraph, image, table, formula…) so the title
// layout can use the full block toolbox, not just lines and spacers.
export interface TitleContentBlock {
  id: string
  type: 'titleContent'
  block: ReportBlock
}

// lines × fontSize(pt) × lineSpacing × (2.54/72) = height in cm
export function spacerHeightCm(lines: number, fontSizePt: number, lineSpacing: number): number {
  return lines * fontSizePt * lineSpacing * (2.54 / 72)
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
  footer: { mode: 'pageNumber', text: '', align: 'right', fontSize: 12, fontFamily: 'Times New Roman' },
  differentFirstPage: true,
  pageNumberStart: 1,
  numbering: { image: 'plain', table: 'plain', code: 'plain', formula: 'plain' },
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
