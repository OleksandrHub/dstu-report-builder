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
} from '../types/document'
import {
  DEFAULT_SETTINGS,
  DEFAULT_TITLE_PAGE,
  DEFAULT_TITLE_TEMPLATE,
  TITLE_TEMPLATES_STORAGE_KEY,
  TITLE_DATA_TEMPLATES_KEY,
} from '../types/document'

const STORAGE_KEY = 'dstu-report-builder-documents'
const ACTIVE_DOC_KEY = 'dstu-report-builder-active'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
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
    blocks: [
      { id: generateId(), type: 'paragraph', text: 'Тема: ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: 'Мета: ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: 'Варіант №1', bold: false, align: 'center' },
      { id: generateId(), type: 'paragraph', text: 'Виконання роботи:', bold: true, align: 'center' },
      { id: generateId(), type: 'paragraph', text: 'Висновки:', bold: true, align: 'center' },
    ],
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
      doc.settings.footer = { mode: 'pageNumber', text: '', align: 'center', fontSize: 12, fontFamily: doc.settings.fontFamily || 'Times New Roman' }
    }
    if (doc.settings && doc.settings.differentFirstPage === undefined) {
      doc.settings.differentFirstPage = true
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

  function addBlock(type: ReportBlock['type'], afterId?: string) {
    const doc = activeDocument.value
    if (!doc) return

    let block: ReportBlock

    if (type === 'paragraph') {
      block = { id: generateId(), type: 'paragraph', text: 'Текст абзацу...' }
    } else if (type === 'heading') {
      block = { id: generateId(), type: 'heading', text: 'Заголовок', level: 1 }
    } else if (type === 'list') {
      block = {
        id: generateId(),
        type: 'list',
        ordered: false,
        items: [
          { id: generateId(), text: 'перший елемент' },
          { id: generateId(), text: 'другий елемент' },
        ],
        introText: 'Перелік містить наступні елементи:',
      }
    } else if (type === 'code') {
      block = {
        id: generateId(),
        type: 'code',
        caption: 'Назва лістингу',
        code: '// Ваш код тут\n',
        language: 'typescript',
        referenceText: 'Код програми подано у лістингу {no}.',
      }
    } else if (type === 'image') {
      block = {
        id: generateId(),
        type: 'image',
        src: '',
        caption: 'Назва рисунка',
        referenceText: 'Результат роботи програми наведено на рисунку {no}.',
      }
    } else {
      block = {
        id: generateId(),
        type: 'table',
        caption: 'Назва таблиці',
        headers: ['Стовпець 1', 'Стовпець 2'],
        rows: [
          { id: generateId(), cells: [{ text: '' }, { text: '' }] },
        ],
        referenceText: 'Дані наведено у таблиці {no}.',
      }
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
      { id: generateId(), type: 'paragraph', text: 'Тема: ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: 'Мета: ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: 'Варіант №1', bold: false, align: 'center' },
      { id: generateId(), type: 'paragraph', text: 'Виконання роботи:', bold: true, align: 'center' },
      { id: generateId(), type: 'paragraph', text: 'Висновки:', bold: true, align: 'center' },
    ]
    doc.blocks = [...introBlocks, ...doc.blocks]
    touchActive()
  }

  function removeBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    doc.blocks = doc.blocks.filter(b => b.id !== id)
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

  function addListItem(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    block.items.push({ id: generateId(), text: '' })
    touchActive()
  }

  function removeListItem(blockId: string, itemId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    block.items = block.items.filter((i: ListItem) => i.id !== itemId)
    touchActive()
  }

  function updateListItem(blockId: string, itemId: string, text: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = doc.blocks.find(b => b.id === blockId)
    if (!block || block.type !== 'list') return
    const item = block.items.find((i: ListItem) => i.id === itemId)
    if (item) { item.text = text; touchActive() }
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
    removeBlock,
    moveBlock,
    updateBlock,
    addListItem,
    removeListItem,
    updateListItem,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    toggleTableRowSplit,
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
