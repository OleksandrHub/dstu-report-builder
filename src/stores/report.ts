import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  ReportDocument,
  ReportBlock,
  DocumentSettings,
  TitlePageData,
  ListItem,
  TableRow,
  TitleBlock,
  TitleSpacerBlock,
  TitlePageTemplate,
  TitleDataTemplate,
  SourceEntry,
  SourcesBlock,
  ColumnsBlock,
} from '../types/document'
import {
  DEFAULT_SETTINGS,
  DEFAULT_TITLE_PAGE,
  DEFAULT_TITLE_TEMPLATE,
  TITLE_TEMPLATES_STORAGE_KEY,
  TITLE_DATA_TEMPLATES_KEY,
  parseMarkdownTable,
} from '../types/document'

const STORAGE_KEY = 'dstu-report-builder-documents'
const ACTIVE_DOC_KEY = 'dstu-report-builder-active'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function emptySourceEntry(): SourceEntry {
  return {
    id: generateId(),
    type: 'book',
    authors: '', title: '', city: '', publisher: '', year: '',
    pages: '', journal: '', url: '', accessDate: '',
  }
}

function deepCloneTitleBlocks(blocks: TitleBlock[]): TitleBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as TitleBlock[]
}

function createDocument(name: string): ReportDocument {
  return {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    titlePage: { ...DEFAULT_TITLE_PAGE, year: new Date().getFullYear().toString() },
    titleTemplate: deepCloneTitleBlocks(DEFAULT_TITLE_TEMPLATE),
    settings: { ...DEFAULT_SETTINGS },
    blocks: [],
  }
}

function loadTemplatesFromStorage(): TitlePageTemplate[] {
  try {
    const raw = localStorage.getItem(TITLE_TEMPLATES_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TitlePageTemplate[]
  } catch {
    return []
  }
}

function saveTemplatesToStorage(templates: TitlePageTemplate[]) {
  localStorage.setItem(TITLE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
}

function loadDataTemplatesFromStorage(): TitleDataTemplate[] {
  try {
    const raw = localStorage.getItem(TITLE_DATA_TEMPLATES_KEY)
    return raw ? (JSON.parse(raw) as TitleDataTemplate[]) : []
  } catch {
    return []
  }
}

function saveDataTemplatesToStorage(templates: TitleDataTemplate[]) {
  localStorage.setItem(TITLE_DATA_TEMPLATES_KEY, JSON.stringify(templates))
}

function loadFromStorage(): ReportDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ReportDocument[]
  } catch {
    return []
  }
}

function saveToStorage(docs: ReportDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

export const useReportStore = defineStore('report', () => {
  const rawDocs = loadFromStorage()
  // Migrate: add titleTemplate to old documents that don't have it
  for (const doc of rawDocs) {
    if (!doc.titleTemplate) {
      doc.titleTemplate = deepCloneTitleBlocks(DEFAULT_TITLE_TEMPLATE)
    } else {
      for (const block of doc.titleTemplate) {
        if (block.type === 'titleLine') {
          if (block.paddingLeft === undefined) block.paddingLeft = 0
          if (block.paddingRight === undefined) block.paddingRight = 0
        }
        if (block.type === 'titleSpacer') {
          const b = block as TitleSpacerBlock & { flex?: number; heightCm?: number }
          if (b.lines === undefined) {
            // migrate old flex or heightCm → lines (1 line ≈ 0.74cm at 14pt×1.5)
            b.lines = b.flex ?? (Math.round((b.heightCm ?? 2) / 0.74) || 1)
          }
          delete b.flex
          delete b.heightCm
        }
      }
    }
  }

  // Migrate: add header/footer settings to old documents
  for (const doc of rawDocs) {
    if (doc.settings && !doc.settings.header) {
      doc.settings.header = { mode: 'none', text: '', align: 'right', fontSize: 12, fontFamily: doc.settings.fontFamily || 'Times New Roman' }
    }
    if (doc.settings && !doc.settings.footer) {
      doc.settings.footer = { mode: 'pageNumber', text: '', align: 'right', fontSize: 12, fontFamily: doc.settings.fontFamily || 'Times New Roman' }
    }
    if (doc.settings && doc.settings.differentFirstPage === undefined) {
      doc.settings.differentFirstPage = true
    }
    if (doc.settings && doc.settings.pageNumberStart === undefined) {
      doc.settings.pageNumberStart = 1
    }
    if (doc.settings && !doc.settings.numbering) {
      // migrate old single numberingScheme → per-type, default 'plain'
      const old = (doc.settings as { numberingScheme?: 'plain' | 'perSection' | 'sectioned' }).numberingScheme ?? 'plain'
      doc.settings.numbering = { image: old, table: old, code: old, formula: old }
    }
    if (doc.settings && doc.settings.formulaPrefix === undefined) {
      doc.settings.formulaPrefix = 'Формула'
    }
  }

  // Migrate: append {no} placeholder to legacy referenceText (so number isn't auto-doubled)
  for (const doc of rawDocs) {
    if (!doc.blocks) continue
    for (const b of doc.blocks) {
      if ((b.type === 'code' || b.type === 'image' || b.type === 'table') && b.referenceText && !b.referenceText.includes('{no}')) {
        const t = b.referenceText.trim()
        if (b.type === 'table') {
          // old table format auto-wrapped "У таблиці N <text>." — convert to explicit sentence
          b.referenceText = `У таблиці {no} ${t.toLowerCase()}.`
        } else {
          b.referenceText = `${t.replace(/\.$/, '')} {no}.`
        }
      }
    }
  }

  // Migrate: convert old intro field into paragraph blocks prepended to blocks[]
  for (const doc of rawDocs) {
    const d = doc as ReportDocument & { intro?: { topic?: string; goal?: string; variant?: string } }
    if (d.intro) {
      const introBlocks: ReportBlock[] = []
      if (d.intro.topic) introBlocks.push({ id: generateId(), type: 'paragraph', text: `Тема: ${d.intro.topic}.` })
      if (d.intro.goal) introBlocks.push({ id: generateId(), type: 'paragraph', text: `Мета: ${d.intro.goal}.` })
      if (d.intro.variant) introBlocks.push({ id: generateId(), type: 'paragraph', text: `Варіант №${d.intro.variant}` })
      introBlocks.push({ id: generateId(), type: 'paragraph', text: 'Виконання роботи:' })
      doc.blocks = [...introBlocks, ...doc.blocks]
      delete d.intro
    }
  }

  const documents = ref<ReportDocument[]>(rawDocs)
  const activeDocumentId = ref<string | null>(localStorage.getItem(ACTIVE_DOC_KEY))
  const titleTemplates = ref<TitlePageTemplate[]>(loadTemplatesFromStorage())
  const titleDataTemplates = ref<TitleDataTemplate[]>(loadDataTemplatesFromStorage())

  if (documents.value.length === 0) {
    const first = createDocument('Лабораторна робота №1')
    documents.value.push(first)
    activeDocumentId.value = first.id
  }

  if (activeDocumentId.value && !documents.value.find(d => d.id === activeDocumentId.value)) {
    activeDocumentId.value = documents.value[0]?.id ?? null
  }

  watch(titleTemplates, (t) => saveTemplatesToStorage(t), { deep: true })
  watch(titleDataTemplates, (t) => saveDataTemplatesToStorage(t), { deep: true })

  const activeDocument = computed<ReportDocument | null>(() =>
    documents.value.find(d => d.id === activeDocumentId.value) ?? null
  )

  watch(
    documents,
    (docs) => saveToStorage(docs),
    { deep: true }
  )

  watch(activeDocumentId, (id) => {
    if (id) localStorage.setItem(ACTIVE_DOC_KEY, id)
  })

  function touchActive() {
    const doc = activeDocument.value
    if (doc) doc.updatedAt = new Date().toISOString()
  }

  // --- Document management ---

  function createNewDocument(name: string): string {
    const doc = createDocument(name)
    documents.value.push(doc)
    activeDocumentId.value = doc.id
    return doc.id
  }

  function duplicateDocument(id: string): string {
    const src = documents.value.find(d => d.id === id)
    if (!src) return ''
    const copy: ReportDocument = JSON.parse(JSON.stringify(src))
    copy.id = generateId()
    copy.name = src.name + ' (копія)'
    copy.createdAt = new Date().toISOString()
    copy.updatedAt = new Date().toISOString()
    copy.blocks = copy.blocks.map(b => ({ ...b, id: generateId() }))
    documents.value.push(copy)
    activeDocumentId.value = copy.id
    return copy.id
  }

  function deleteDocument(id: string) {
    const idx = documents.value.findIndex(d => d.id === id)
    if (idx === -1) return
    documents.value.splice(idx, 1)
    if (documents.value.length === 0) {
      const fresh = createDocument('Лабораторна робота №1')
      documents.value.push(fresh)
      activeDocumentId.value = fresh.id
    } else if (activeDocumentId.value === id) {
      activeDocumentId.value = documents.value[0]!.id
    }
  }

  function renameDocument(id: string, name: string) {
    const doc = documents.value.find(d => d.id === id)
    if (doc) { doc.name = name; doc.updatedAt = new Date().toISOString() }
  }

  function setActiveDocument(id: string) {
    activeDocumentId.value = id
  }

  // --- Title page ---

  function updateTitlePage(data: Partial<TitlePageData>) {
    const doc = activeDocument.value
    if (!doc) return
    doc.titlePage = { ...doc.titlePage, ...data }
    touchActive()
  }

  // --- Settings ---

  function updateSettings(data: Partial<DocumentSettings>) {
    const doc = activeDocument.value
    if (!doc) return
    doc.settings = { ...doc.settings, ...data }
    touchActive()
  }

  // --- Blocks ---

  function addBlock(type: ReportBlock['type'], afterId?: string, position?: 'start') {
    const doc = activeDocument.value
    if (!doc) return

    let block: ReportBlock

    if (type === 'paragraph') {
      block = { id: generateId(), type: 'paragraph', text: '' }
    } else if (type === 'text') {
      block = { id: generateId(), type: 'text', text: '' }
    } else if (type === 'heading') {
      block = { id: generateId(), type: 'heading', text: '', level: 1 }
    } else if (type === 'list') {
      block = {
        id: generateId(),
        type: 'list',
        ordered: false,
        items: [
          { id: generateId(), text: '' },
        ],
        introText: '',
      }
    } else if (type === 'code') {
      block = {
        id: generateId(),
        type: 'code',
        caption: '',
        code: '',
        language: 'typescript',
        referenceText: 'Код програми подано у лістингу {no}.',
      }
    } else if (type === 'image') {
      block = {
        id: generateId(),
        type: 'image',
        src: '',
        caption: '',
        referenceText: 'Результат роботи програми наведено на рисунку {no}.',
      }
    } else if (type === 'table') {
      block = {
        id: generateId(),
        type: 'table',
        caption: '',
        headers: ['Стовпець 1', 'Стовпець 2'],
        rows: [
          { id: generateId(), cells: [{ text: '' }, { text: '' }] },
        ],
        referenceText: 'Дані наведено у таблиці {no}.',
      }
    } else if (type === 'formula') {
      block = {
        id: generateId(),
        type: 'formula',
        latex: 'E = mc^2',
        caption: '',
        referenceText: '',
        numbered: true,
      }
    } else if (type === 'pageBreak') {
      block = { id: generateId(), type: 'pageBreak' }
    } else if (type === 'spacer') {
      block = { id: generateId(), type: 'spacer', lines: 1 }
    } else if (type === 'toc') {
      block = { id: generateId(), type: 'toc', title: 'Зміст' }
    } else if (type === 'sources') {
      block = {
        id: generateId(),
        type: 'sources',
        title: 'Список використаних джерел',
        entries: [emptySourceEntry()],
      }
    } else {
      block = {
        id: generateId(),
        type: 'columns',
        columns: [
          { id: generateId(), width: 50, blocks: [{ id: generateId(), type: 'paragraph', text: 'Текст лівого стовпця...' }] },
          { id: generateId(), width: 50, blocks: [{ id: generateId(), type: 'paragraph', text: 'Текст правого стовпця...' }] },
        ],
      }
    }

    if (position === 'start') {
      doc.blocks.unshift(block)
      touchActive()
      return
    }

    if (afterId) {
      const idx = doc.blocks.findIndex(b => b.id === afterId)
      if (idx !== -1) {
        doc.blocks.splice(idx + 1, 0, block)
        touchActive()
        return
      }
    }

    doc.blocks.push(block)
    touchActive()
  }

  function addIntroBlocks() {
    const doc = activeDocument.value
    if (!doc) return
    const introBlocks: ReportBlock[] = [
      { id: generateId(), type: 'paragraph', text: '**Тема:** ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: '**Мета:** ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: 'Варіант №1', bold: false, align: 'center' },
      { id: generateId(), type: 'paragraph', text: 'Виконання роботи:', bold: true, align: 'center' },
      { id: generateId(), type: 'paragraph', text: '**Висновки:** ', bold: false, align: 'justify' },
    ]
    doc.blocks = [...introBlocks, ...doc.blocks]
    touchActive()
  }

  // Apply a string transform to every user-editable text field across all blocks.
  // Returns the number of fields changed.
  function transformAllText(fn: (s: string) => string): number {
    const doc = activeDocument.value
    if (!doc) return 0
    let changed = 0
    const apply = (s: string | undefined): string | undefined => {
      if (s == null) return s
      const out = fn(s)
      if (out !== s) changed++
      return out
    }
    const applyItems = (items: ListItem[]) => {
      items.forEach(i => {
        i.text = apply(i.text)!
        if (i.children) applyItems(i.children)
      })
    }
    for (const b of doc.blocks) {
      if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'text') {
        b.text = apply(b.text)!
      } else if (b.type === 'list') {
        if (b.introText !== undefined) b.introText = apply(b.introText)
        applyItems(b.items)
      } else if (b.type === 'code') {
        b.caption = apply(b.caption)!
        b.code = apply(b.code)!
        b.referenceText = apply(b.referenceText)
      } else if (b.type === 'image') {
        b.caption = apply(b.caption)!
        b.referenceText = apply(b.referenceText)
      } else if (b.type === 'table') {
        b.caption = apply(b.caption)!
        b.referenceText = apply(b.referenceText)
        b.headers = b.headers.map(h => apply(h)!)
        b.rows.forEach(r => r.cells.forEach(c => { c.text = apply(c.text)! }))
      } else if (b.type === 'formula') {
        if (b.caption !== undefined) b.caption = apply(b.caption)
        b.referenceText = apply(b.referenceText)
      } else if (b.type === 'toc') {
        if (b.title !== undefined) b.title = apply(b.title)
      }
    }
    if (changed) touchActive()
    return changed
  }

  function replaceAllText(find: string, replace: string, caseSensitive = false): number {
    if (!find) return 0
    const flags = caseSensitive ? 'g' : 'gi'
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    return transformAllText(s => s.replace(re, replace))
  }

  // Replace em dash (—) and hyphen-minus used as dashes with the en dash (–).
  function emDashToEnDash(): number {
    return transformAllText(s => s.replace(/—/g, '–'))
  }

  function removeBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    doc.blocks = doc.blocks.filter(b => b.id !== id)
    touchActive()
  }

  // Deep-clone a block and assign fresh ids to it and every nested entity.
  function cloneBlockWithNewIds(block: ReportBlock): ReportBlock {
    const copy = JSON.parse(JSON.stringify(block)) as ReportBlock
    const reid = (o: { id?: string }) => { if (o && typeof o === 'object' && 'id' in o) o.id = generateId() }
    copy.id = generateId()
    const reItems = (items?: ListItem[]) => items?.forEach(i => { reid(i); reItems(i.children) })
    if (copy.type === 'list') reItems(copy.items)
    else if (copy.type === 'table') copy.rows.forEach(reid)
    else if (copy.type === 'sources') copy.entries.forEach(reid)
    else if (copy.type === 'columns') copy.columns.forEach(c => { reid(c); c.blocks.forEach(reid) })
    return copy
  }

  function duplicateBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    const copy = cloneBlockWithNewIds(doc.blocks[idx]!)
    doc.blocks.splice(idx + 1, 0, copy)
    touchActive()
  }

  function moveBlock(id: string, direction: 'up' | 'down') {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === doc.blocks.length - 1) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    const tmp = doc.blocks[idx]!
    doc.blocks[idx] = doc.blocks[target]!
    doc.blocks[target] = tmp
    touchActive()
  }

  function updateBlock(id: string, data: Partial<ReportBlock>) {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    doc.blocks[idx] = { ...doc.blocks[idx], ...data } as ReportBlock
    touchActive()
  }

  // --- List helpers ---

  // Find an item (and its sibling array) anywhere in a nested list tree.
  function findListItem(items: ListItem[], itemId: string): { item: ListItem; siblings: ListItem[] } | null {
    for (const i of items) {
      if (i.id === itemId) return { item: i, siblings: items }
      if (i.children) {
        const found = findListItem(i.children, itemId)
        if (found) return found
      }
    }
    return null
  }

  function addListItem(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    block.items.push({ id: generateId(), text: '' })
    touchActive()
  }

  function addSubListItem(blockId: string, parentItemId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, parentItemId)
    if (!found) return
    if (!found.item.children) found.item.children = []
    found.item.children.push({ id: generateId(), text: '' })
    touchActive()
  }

  function removeListItem(blockId: string, itemId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, itemId)
    if (!found) return
    const idx = found.siblings.findIndex(i => i.id === itemId)
    if (idx !== -1) found.siblings.splice(idx, 1)
    touchActive()
  }

  function updateListItem(blockId: string, itemId: string, text: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, itemId)
    if (found) { found.item.text = text; touchActive() }
  }

  // --- Table helpers ---

  function addTableRow(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    const newRow: TableRow = {
      id: generateId(),
      cells: block.headers.map(() => ({ text: '' })),
    }
    block.rows.push(newRow)
    touchActive()
  }

  function removeTableRow(blockId: string, rowId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    block.rows = block.rows.filter((r: TableRow) => r.id !== rowId)
    touchActive()
  }

  function addTableColumn(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    block.headers.push('Стовпець ' + (block.headers.length + 1))
    block.rows.forEach((r: TableRow) => r.cells.push({ text: '' }))
    touchActive()
  }

  function setTableFullWidth(blockId: string, full: boolean) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    block.fullWidth = full
    touchActive()
  }

  function setTableColumnWidth(blockId: string, colIndex: number, pct: number) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    const n = block.headers.length
    // Initialize to an even split if no explicit widths yet.
    if (!block.columnWidths || block.columnWidths.length !== n) {
      block.columnWidths = Array.from({ length: n }, () => Math.round(100 / n))
    }
    block.columnWidths[colIndex] = pct
    touchActive()
  }

  function resetTableColumnWidths(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    block.columnWidths = undefined
    touchActive()
  }

  function importMarkdownTable(blockId: string, md: string): boolean {
    const doc = activeDocument.value
    if (!doc) return false
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return false
    const parsed = parseMarkdownTable(md)
    if (!parsed || parsed.headers.length === 0) return false
    block.headers = [...parsed.headers]
    block.rows = parsed.rows.map(cells => ({
      id: generateId(),
      cells: cells.map(text => ({ text })),
    }))
    // Column count changed → drop stale explicit widths.
    block.columnWidths = undefined
    touchActive()
    return true
  }

  function toggleTableRowSplit(blockId: string, rowId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    const row = block.rows.find((r: TableRow) => r.id === rowId)
    if (!row) return
    row.splitBefore = !row.splitBefore
    touchActive()
  }

  function removeTableColumn(blockId: string, colIndex: number) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'table') return
    if (block.headers.length <= 1) return
    block.headers.splice(colIndex, 1)
    block.rows.forEach((r: TableRow) => r.cells.splice(colIndex, 1))
    touchActive()
  }

  // --- Sources (ДСТУ) helpers ---

  function findSourcesBlock(blockId: string): SourcesBlock | null {
    const doc = activeDocument.value
    if (!doc) return null
    const b = doc.blocks.find(x => x.id === blockId)
    return b && b.type === 'sources' ? b : null
  }

  function addSource(blockId: string) {
    const b = findSourcesBlock(blockId)
    if (!b) return
    b.entries.push(emptySourceEntry())
    touchActive()
  }

  function removeSource(blockId: string, entryId: string) {
    const b = findSourcesBlock(blockId)
    if (!b) return
    b.entries = b.entries.filter(e => e.id !== entryId)
    touchActive()
  }

  function updateSource(blockId: string, entryId: string, data: Partial<SourceEntry>) {
    const b = findSourcesBlock(blockId)
    if (!b) return
    const e = b.entries.find(x => x.id === entryId)
    if (!e) return
    Object.assign(e, data)
    touchActive()
  }

  function moveSource(blockId: string, entryId: string, dir: 'up' | 'down') {
    const b = findSourcesBlock(blockId)
    if (!b) return
    const i = b.entries.findIndex(e => e.id === entryId)
    if (i === -1) return
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= b.entries.length) return
    const tmp = b.entries[i]!
    b.entries[i] = b.entries[j]!
    b.entries[j] = tmp
    touchActive()
  }

  // --- Columns helpers ---

  function findColumnsBlock(blockId: string): ColumnsBlock | null {
    const doc = activeDocument.value
    if (!doc) return null
    const b = doc.blocks.find(x => x.id === blockId)
    return b && b.type === 'columns' ? b : null
  }

  function setColumnCount(blockId: string, count: number) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const n = Math.max(1, Math.min(4, count))
    const cur = b.columns.length
    if (n > cur) {
      for (let i = cur; i < n; i++) {
        b.columns.push({ id: generateId(), width: 0, blocks: [{ id: generateId(), type: 'paragraph', text: '' }] })
      }
    } else if (n < cur) {
      b.columns = b.columns.slice(0, n)
    }
    // Even widths.
    const w = Math.round(100 / n)
    b.columns.forEach(c => { c.width = w })
    touchActive()
  }

  function setColumnWidth(blockId: string, colId: string, width: number) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const c = b.columns.find(x => x.id === colId)
    if (!c) return
    c.width = width
    touchActive()
  }

  function addColumnBlock(blockId: string, colId: string, type: ReportBlock['type']) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const col = b.columns.find(x => x.id === colId)
    if (!col) return
    let nb: ReportBlock
    if (type === 'heading') nb = { id: generateId(), type: 'heading', text: 'Заголовок', level: 2 }
    else if (type === 'image') nb = { id: generateId(), type: 'image', src: '', caption: 'Назва рисунка', referenceText: '' }
    else nb = { id: generateId(), type: 'paragraph', text: 'Текст...' }
    col.blocks.push(nb)
    touchActive()
  }

  function updateColumnBlock(blockId: string, colId: string, innerId: string, data: Partial<ReportBlock>) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const col = b.columns.find(x => x.id === colId)
    if (!col) return
    const idx = col.blocks.findIndex(x => x.id === innerId)
    if (idx === -1) return
    col.blocks[idx] = { ...col.blocks[idx], ...data } as ReportBlock
    touchActive()
  }

  function removeColumnBlock(blockId: string, colId: string, innerId: string) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const col = b.columns.find(x => x.id === colId)
    if (!col) return
    col.blocks = col.blocks.filter(x => x.id !== innerId)
    touchActive()
  }

  function getBlockIndex(blockId: string, type: ReportBlock['type']): number {
    const doc = activeDocument.value
    if (!doc) return 0
    const filtered = doc.blocks.filter(b => b.type === type)
    return filtered.findIndex(b => b.id === blockId) + 1
  }

  // --- Title template (per-document blocks) ---

  function addTitleBlock(type: TitleBlock['type'], afterId?: string) {
    const doc = activeDocument.value
    if (!doc) return
    const newBlock: TitleBlock = type === 'titleSpacer'
      ? { id: generateId(), type: 'titleSpacer', lines: 1 }
      : { id: generateId(), type: 'titleLine', text: 'Новий рядок', align: 'center', bold: false, spaceBefore: false, paddingLeft: 0, paddingRight: 0 }

    if (afterId) {
      const idx = doc.titleTemplate.findIndex(b => b.id === afterId)
      if (idx !== -1) {
        doc.titleTemplate.splice(idx + 1, 0, newBlock)
        touchActive()
        return
      }
    }
    doc.titleTemplate.push(newBlock)
    touchActive()
  }

  function removeTitleBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    doc.titleTemplate = doc.titleTemplate.filter(b => b.id !== id)
    touchActive()
  }

  function moveTitleBlock(id: string, direction: 'up' | 'down') {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.titleTemplate.findIndex(b => b.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === doc.titleTemplate.length - 1) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    const tmp = doc.titleTemplate[idx]!
    doc.titleTemplate[idx] = doc.titleTemplate[target]!
    doc.titleTemplate[target] = tmp
    touchActive()
  }

  function updateTitleBlock(id: string, data: Partial<TitleBlock>) {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.titleTemplate.findIndex(b => b.id === id)
    if (idx === -1) return
    doc.titleTemplate[idx] = { ...doc.titleTemplate[idx], ...data } as TitleBlock
    touchActive()
  }

  function resetTitleTemplate() {
    const doc = activeDocument.value
    if (!doc) return
    doc.titleTemplate = deepCloneTitleBlocks(DEFAULT_TITLE_TEMPLATE)
    touchActive()
  }

  // --- Global title templates (presets) ---

  function saveAsTemplate(name: string) {
    const doc = activeDocument.value
    if (!doc) return
    const template: TitlePageTemplate = {
      id: generateId(),
      name,
      blocks: deepCloneTitleBlocks(doc.titleTemplate),
    }
    titleTemplates.value.push(template)
  }

  function applyTemplate(templateId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const tpl = titleTemplates.value.find(t => t.id === templateId)
    if (!tpl) return
    doc.titleTemplate = deepCloneTitleBlocks(tpl.blocks)
    touchActive()
  }

  function deleteTemplate(templateId: string) {
    titleTemplates.value = titleTemplates.value.filter(t => t.id !== templateId)
  }

  function renameTemplate(templateId: string, name: string) {
    const tpl = titleTemplates.value.find(t => t.id === templateId)
    if (tpl) tpl.name = name
  }

  // --- Title data templates ---

  function saveAsDataTemplate(name: string) {
    const doc = activeDocument.value
    if (!doc) return
    titleDataTemplates.value.push({
      id: generateId(),
      name,
      data: { ...doc.titlePage },
    })
  }

  function applyDataTemplate(templateId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const tpl = titleDataTemplates.value.find(t => t.id === templateId)
    if (!tpl) return
    doc.titlePage = { ...doc.titlePage, ...tpl.data }
    touchActive()
  }

  function deleteDataTemplate(templateId: string) {
    titleDataTemplates.value = titleDataTemplates.value.filter(t => t.id !== templateId)
  }

  function renameDataTemplate(templateId: string, name: string) {
    const tpl = titleDataTemplates.value.find(t => t.id === templateId)
    if (tpl) tpl.name = name
  }

  return {
    documents,
    activeDocumentId,
    activeDocument,
    titleTemplates,
    createNewDocument,
    duplicateDocument,
    deleteDocument,
    renameDocument,
    setActiveDocument,
    updateTitlePage,
    updateSettings,
    addBlock,
    addIntroBlocks,
    replaceAllText,
    emDashToEnDash,
    addSource,
    removeSource,
    updateSource,
    moveSource,
    setColumnCount,
    setColumnWidth,
    addColumnBlock,
    updateColumnBlock,
    removeColumnBlock,
    removeBlock,
    duplicateBlock,
    moveBlock,
    updateBlock,
    addListItem,
    addSubListItem,
    removeListItem,
    updateListItem,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    toggleTableRowSplit,
    setTableFullWidth,
    setTableColumnWidth,
    resetTableColumnWidths,
    importMarkdownTable,
    getBlockIndex,
    addTitleBlock,
    removeTitleBlock,
    moveTitleBlock,
    updateTitleBlock,
    resetTitleTemplate,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate,
    renameTemplate,
    titleDataTemplates,
    saveAsDataTemplate,
    applyDataTemplate,
    deleteDataTemplate,
    renameDataTemplate,
  }
})
