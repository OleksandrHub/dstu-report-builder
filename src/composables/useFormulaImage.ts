import katex from 'katex'
import 'katex/dist/katex.min.css'

export interface FormulaImage {
  dataUrl: string // PNG data URL
  width: number   // px (CSS pixels at scale 1)
  height: number
}

// Render LaTeX to a transparent PNG via KaTeX → HTML → SVG <foreignObject> → canvas.
// Runs in the browser only (used at export time). Returns null on failure.
export async function renderFormulaPng(latex: string, fontSizePx = 22, scale = 3): Promise<FormulaImage | null> {
  if (!latex.trim()) return null
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      output: 'html',
    })

    // Wrap the KaTeX HTML in an off-screen element to measure it.
    const holder = document.createElement('div')
    holder.style.cssText =
      `position:fixed;left:-99999px;top:0;font-size:${fontSizePx}px;color:#000;` +
      'background:transparent;display:inline-block;padding:4px;'
    holder.innerHTML = html
    document.body.appendChild(holder)

    // Ensure KaTeX fonts are loaded before measuring/serializing.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts) await fonts.ready

    const rect = holder.getBoundingClientRect()
    const w = Math.ceil(rect.width) || 10
    const h = Math.ceil(rect.height) || 10

    // Inline the KaTeX stylesheet so the SVG render is self-contained.
    const css = collectKatexCss()
    const xhtml = `<div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSizePx}px;color:#000;display:inline-block;">${html}</div>`
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs><style>${css}</style></defs>` +
      `<foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`

    document.body.removeChild(holder)

    const dataUrl = await svgToPng(svg, w, h, scale)
    return dataUrl ? { dataUrl, width: w, height: h } : null
  } catch {
    return null
  }
}

let cachedCss: string | null = null
function collectKatexCss(): string {
  if (cachedCss != null) return cachedCss
  let out = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (!rules) continue
      for (const rule of Array.from(rules)) {
        const text = rule.cssText
        if (text.includes('katex') || text.startsWith('@font-face')) out += text + '\n'
      }
    } catch {
      // cross-origin sheet — skip
    }
  }
  cachedCss = out
  return out
}

function svgToPng(svg: string, w: number, h: number, scale: number): Promise<string | null> {
  return new Promise((resolve) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      try { resolve(canvas.toDataURL('image/png')) } catch { resolve(null) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
