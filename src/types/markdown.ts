export interface ParsedMarkdownTable {
  headers: string[]
  rows: string[][]
}

// Parse a GitHub-flavored Markdown table into headers + rows. Accepts optional
// leading/trailing pipes; the separator row (---|:--:) is skipped. Returns null
// if the text doesn't look like a table.
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
  if (lines.length >= 2 && isSeparator(lines[1]!)) bodyStart = 2

  const headers = splitRow(headerLine)
  if (headers.length === 0) return null

  const rows: string[][] = []
  for (let i = bodyStart; i < lines.length; i++) {
    if (isSeparator(lines[i]!)) continue
    const cells = splitRow(lines[i]!)
    while (cells.length < headers.length) cells.push('')
    rows.push(cells.slice(0, headers.length))
  }
  return { headers, rows }
}
