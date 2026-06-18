import { buildDocxBlob } from './docx/build-document'
import type { ReportDocument } from '../types/document'

export function useDocxExport() {
  async function exportToDocx(doc: ReportDocument): Promise<void> {
    const blob = await buildDocxBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.name.replace(/\s+/g, '_')}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function getPreviewBlob(doc: ReportDocument): Promise<Blob> {
    return buildDocxBlob(doc, true)
  }

  return { exportToDocx, getPreviewBlob }
}
