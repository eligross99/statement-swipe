// Prints a PDF statement's text layout with personal details masked, for building the PDF reader.
// Masking (src/lib/pdfMask.ts) turns letters into X/x and digits into 9, except common statement words,
// so the layout can be shared without sharing merchants, amounts, names, or account numbers.
// Everything runs on this computer. Usage (Node 23+): node scripts/pdf-layout.ts private/statement.pdf

import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { toLines, type TextFragment } from '../src/lib/pdfLines.ts'
import { maskLine } from '../src/lib/pdfMask.ts'

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
  for (const line of toLines(fragments, p)) console.log(maskLine(line))
}
