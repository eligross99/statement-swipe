// A PDF statement's layout with every personal detail masked: letters become X/x and digits become 9,
// except common statement words (Purchases, Payment, Total…). What's left shows where things sit on
// the page, which is what the PDF reader needs to learn a new bank's statements, without any
// merchants, amounts, names, or account numbers.
// Used by "Help fix this for your bank" on Import (the user sees it all before sharing) and by
// scripts/pdf-layout.ts. Pure, dependency-free code, so the script can run it with Node directly.

import type { Line } from './pdfLines'

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

/** Masks one piece of text: "SHELL OIL 574123900" → "XXXXX XXX 999999999". */
export function mask(text: string): string {
  return text.replace(/[A-Za-z]+|\d/g, (w) => {
    if (/\d/.test(w)) return '9'
    if (KEEP.has(w.toLowerCase())) return w
    return w.replace(/[A-Z]/g, 'X').replace(/[a-z]/g, 'x')
  })
}

/** One line of the layout: its height on the page, then each cell's left edge and masked text. */
export function maskLine(line: Line): string {
  return `y${line.y}  ${line.cells.map((cell) => `@${Math.round(cell.x)} ${mask(cell.text)}`).join('  |  ')}`
}

/** A whole statement's masked layout, page by page, as plain text to share. */
export function maskedLayout(lines: Line[], about: string): string {
  const out = [about]
  let page = 0
  for (const line of lines) {
    if (line.page !== page) {
      page = line.page
      out.push('', `=== Page ${page} ===`)
    }
    out.push(maskLine(line))
  }
  return out.join('\n')
}
