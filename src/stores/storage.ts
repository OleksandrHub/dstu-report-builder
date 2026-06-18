import type {
  ReportDocument,
  TitlePageTemplate,
  TitleDataTemplate,
} from '../types/document'
import {
  TITLE_TEMPLATES_STORAGE_KEY,
  TITLE_DATA_TEMPLATES_KEY,
} from '../types/document'

export const STORAGE_KEY = 'dstu-report-builder-documents'
export const ACTIVE_DOC_KEY = 'dstu-report-builder-active'

export function loadTemplatesFromStorage(): TitlePageTemplate[] {
  try {
    const raw = localStorage.getItem(TITLE_TEMPLATES_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TitlePageTemplate[]
  } catch {
    return []
  }
}

export function saveTemplatesToStorage(templates: TitlePageTemplate[]) {
  localStorage.setItem(TITLE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
}

export function loadDataTemplatesFromStorage(): TitleDataTemplate[] {
  try {
    const raw = localStorage.getItem(TITLE_DATA_TEMPLATES_KEY)
    return raw ? (JSON.parse(raw) as TitleDataTemplate[]) : []
  } catch {
    return []
  }
}

export function saveDataTemplatesToStorage(templates: TitleDataTemplate[]) {
  localStorage.setItem(TITLE_DATA_TEMPLATES_KEY, JSON.stringify(templates))
}

export function loadFromStorage(): ReportDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ReportDocument[]
  } catch {
    return []
  }
}

export function saveToStorage(docs: ReportDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}
