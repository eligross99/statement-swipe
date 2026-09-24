// Prints a PDF statement's text layout with personal details masked, for building the PDF reader.
// Letters become X/x and digits become 9, except common statement words (Purchases, Payment, Total…),
// so the layout can be shared without sharing merchants, amounts, names, or account numbers.
// Everything runs on this computer. Usage (Node 23+): node scripts/pdf-layout.ts private/statement.pdf

import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { toLines, type TextFragment } from '../src/lib/pdfLines.ts'

/** Words that are safe to show as-is: statement vocabulary, never personal. */
const KEEP = new Set(
  `account activity adjustments amount and annual apr available balance billing cash charged charges
  closing credit credits cycle date days debits description due fee fees finance for from interest late
  limit merchant minimum new of opening other past payment payments period periods posted posting previous
  purchase purchases rate reference returns statement summary the to total transaction transactions
  transfers type your year-to-date ytd advances balance card number page continued on next in this
  jan feb mar apr may jun jul aug sep oct nov dec january february march april june july august september
  october november december trans post`.split(/\s+/),
)

export function mask(text: string): string {
  return text.replace(/[A-Za-z]+|\d/g, (w) => {
    if (/\d/.test(w)) return '9'
    if (KEEP.has(w.toLowerCase())) return w
    return w.replace(/[A-Z]/g, 'X').replace(/[a-z]/g, 'x')
  })
}

const path = process.argv[2]
if (!path) {
  console.error('Usage: node scripts/pdf-layout.ts <statement.pdf>')
  process.exit(1)
}

const pdf = await getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise
console.log(`${pdf.numPages} pages`)
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p)
  const content = await page.getTextContent()
  const fragments: TextFragment[] = []
  for (const item of content.items) {
    if (!('str' in item)) continue
    const [, , c, d, x, y] = item.transform as number[]
    fragments.push({ str: item.str, x, y, width: item.width, size: Math.hypot(c, d) })
  }
  console.log(`\n=== Page ${p} (${Math.round(page.view[2])}x${Math.round(page.view[3])}) ===`)
  for (const line of toLines(fragments, p)) {
    const cells = line.cells.map((cell) => `@${Math.round(cell.x)} ${mask(cell.text)}`).join('  |  ')
    console.log(`y${line.y}  ${cells}`)
  }
}
