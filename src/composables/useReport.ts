import { computed } from 'vue'
import { useReportStore } from '../stores/report'
import type { ReportBlock } from '../types/document'

export function useReport() {
  const store = useReportStore()

  const doc = computed(() => store.activeDocument)
  const settings = computed(() => store.activeDocument?.settings)

  function getBlockIndex(blockId: string, type: ReportBlock['type']): number {
    return store.getBlockIndex(blockId, type)
  }

  function formatListItem(text: string, ordered: boolean, isLast: boolean): string {
    const cleaned = text.trim()
    if (!cleaned) return cleaned

    let result = ordered
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : cleaned.charAt(0).toLowerCase() + cleaned.slice(1)

    result = result.replace(/[;.,]$/, '')
    result += isLast ? '.' : ';'

    return result
  }

  function getImageCaption(blockId: string, caption: string): string {
    const idx = getBlockIndex(blockId, 'image')
    const prefix = settings.value?.imagePrefix ?? 'Рисунок'
    return `${prefix} ${idx} – ${caption}`
  }

  function getCodeCaption(blockId: string, caption: string): string {
    const idx = getBlockIndex(blockId, 'code')
    const prefix = settings.value?.listingPrefix ?? 'Лістинг'
    return `${prefix} ${idx} – ${caption}`
  }

  function getTableCaption(blockId: string, caption: string): string {
    const idx = getBlockIndex(blockId, 'table')
    const prefix = settings.value?.tablePrefix ?? 'Таблиця'
    return `${prefix} ${idx} – ${caption}`
  }

  function getInlineRef(blockId: string, type: 'image' | 'code' | 'table', text: string): string {
    const idx = getBlockIndex(blockId, type)
    const prefixMap = {
      image: settings.value?.imagePrefix ?? 'Рисунок',
      code: settings.value?.listingPrefix ?? 'Лістинг',
      table: settings.value?.tablePrefix ?? 'Таблиця',
    }
    return `${text} ${prefixMap[type].toLowerCase()} ${idx}.`
  }

  function ptToPx(pt: number): number {
    return pt * (96 / 72)
  }

  const pageStyles = computed(() => {
    const s = settings.value
    if (!s) return {}
    return {
      fontFamily: s.fontFamily,
      fontSize: `${ptToPx(s.fontSize)}px`,
      lineHeight: s.lineSpacing,
      paddingLeft: `${s.marginLeft}cm`,
      paddingRight: `${s.marginRight}cm`,
      paddingTop: `${s.marginTop}cm`,
      paddingBottom: `${s.marginBottom}cm`,
    }
  })

  const paragraphStyles = computed(() => {
    const s = settings.value
    if (!s) return {}
    return {
      textIndent: `${s.paragraphIndent}cm`,
      textAlign: 'justify' as const,
    }
  })

  return {
    doc,
    settings,
    getBlockIndex,
    formatListItem,
    getImageCaption,
    getCodeCaption,
    getTableCaption,
    getInlineRef,
    pageStyles,
    paragraphStyles,
  }
}
