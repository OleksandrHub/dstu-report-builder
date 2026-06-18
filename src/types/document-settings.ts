export type HeaderFooterMode = 'none' | 'text' | 'pageNumber' | 'textAndPage'
export type HeaderFooterAlign = 'left' | 'center' | 'right'

export interface HeaderFooterConfig {
  mode: HeaderFooterMode
  text: string          // used when mode is 'text' or 'textAndPage'
  align: HeaderFooterAlign
  fontSize: number      // pt
  fontFamily: string
}

// 'plain'      → 1, 2, 3 (continuous, ignores sections)
// 'perSection' → 1.1, 1.2, 1.3 (chapter fixed at 1, item runs continuously)
// 'sectioned'  → 1.1, 1.2 … 2.1 (H2 = chapter N, item = N.k)
export type NumberingScheme = 'plain' | 'perSection' | 'sectioned'

export interface NumberingSchemes {
  image: NumberingScheme
  table: NumberingScheme
  code: NumberingScheme
  formula: NumberingScheme
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
  pageNumberStart: number     // number assigned to the very first (title) page
  numbering: NumberingSchemes // per-type numbering schemes
  formulaPrefix: string
}
