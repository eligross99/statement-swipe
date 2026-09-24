// Finds the purchases in a PDF statement's text lines (see pdfLines.ts).
// Statements are laid out for printing, not for reading by software, so this works from
// patterns most US card statements share:
// - A purchase row starts with a date ("07/13", "07/13/26", "Jul 13"), sometimes followed by a
//   posting date, and ends with an amount.
// - Rows sit under section headings like "Payments and Other Credits" or "Purchases".
// - Dates usually have no year; the year comes from the statement's closing date.
// - The statement prints its own purchases total, which lets the app check what it found.

import { PAYMENT_RX, type Purchase } from './csv'
import { toIsoDate } from './dates'
import type { Line } from './pdfLines'

export interface PdfStatement {
  purchases: Purchase[]
  /** Payments and credits that were skipped. */
  skipped: number
  /** The statement's printed purchases total next to what was found, when the statement prints one. */
  check: { printed: number; found: number } | null
  /** The last day the statement covers, as "YYYY-MM-DD", when found. */
  closing: string | null
}

type Section = 'credits' | 'purchases' | 'fees' | 'interest' | null

const MONTH_NAMES = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec'
/** A short date at the start of a row: "07/13", "7/13/26", "07-13-2026", "Jul 13". */
const ROW_DATE = new RegExp(
  String.raw`^(?:(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?|(${MONTH_NAMES})[a-z]*\.?\s+(\d{1,2}))(?=\s|$)`,
  'i',
)
/** An amount at the end of a row: "6.50", "$1,234.56", "+$6.50", "-6.50", "(6.50)", "6.50 CR", "6.50-". */
const ROW_AMOUNT = /(?:^|\s)([-−–+])?\s?\$?\s?(\(?)(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\)?\s?(CR|-)?$/i
/** A cell holding only reference or account numbers, which some statements print beside the description. */
const NUMBERS_ONLY = /^[\d\s#*-]+$/

/** Section headings, tested on lines that aren't purchase rows. */
const HEADINGS: [RegExp, Exclude<Section, null>][] = [
  [/payments?,?\s+(?:and|&)\s+(?:other\s+)?credits|^(?:other\s+)?credits\b|^payments\b/i, 'credits'],
  [/^(?:new\s+)?(?:purchases|charges)\b|purchases?\s+(?:and|&)\s+(?:adjustments|other\s+charges)/i, 'purchases'],
  [/^fees\b|fees\s+charged/i, 'fees'],
  [/^interest\b|interest\s+charged/i, 'interest'],
]
/** A printed purchases total: the transaction list's "Total purchases…" line, or the summary's "Purchases…" line. */
const PURCHASE_TOTAL = /^total\s+(?:new\s+)?(?:purchases|charges)|^(?:new\s+)?purchases\b|^purchases?\s+(?:and|&)\s+adjustments/i
/** Lines whose dates describe the statement itself, for working out the year of row dates. */
const PERIOD_WORDS = /closing|statement\s+(?:date|period)|billing\s+(?:period|cycle)|opening|through/i

const MONTHS = MONTH_NAMES.split('|')

/** Full dates in a line: "07/13/2026", "7/13/26", "July 13, 2026". */
function fullDates(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2})\b/g)) {
    const d = toIsoDate(m[0])
    if (d) out.push(d)
  }
  for (const m of text.matchAll(new RegExp(String.raw`\b(?:${MONTH_NAMES})[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b`, 'gi'))) {
    const d = toIsoDate(m[0])
    if (d) out.push(d)
  }
  // "June 14 - July 13, 2026": the year only follows the second date.
  const range = new RegExp(
    String.raw`\b(${MONTH_NAMES})[a-z]*\.?\s+(\d{1,2})\s*[-–]\s*(${MONTH_NAMES})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b`,
    'i',
  ).exec(text)
  if (range) {
    const end = toIsoDate(`${range[3]} ${range[4]}, ${range[5]}`)
    if (end) out.push(end)
  }
  return out
}

/** The statement's closing date: the latest date on a line about the statement period. */
export function findClosingDate(lines: Line[]): string | null {
  let best: string | null = null
  for (const line of lines) {
    if (!PERIOD_WORDS.test(line.text)) continue
    for (const d of fullDates(line.text)) if (!best || d > best) best = d
  }
  return best
}

/** A row date as "YYYY-MM-DD". Without a year, it's the latest such date on or before the closing date. */
function rowDate(m: RegExpExecArray, closing: string | null): string {
  const month = m[1] ? Number(m[1]) : MONTHS.indexOf(m[4].slice(0, 3).toLowerCase()) + 1
  const day = Number(m[1] ? m[2] : m[5])
  if (m[3]) return toIsoDate(`${month}/${day}/${m[3]}`) ?? m[0]
  const ref = closing ?? new Date().toISOString().slice(0, 10)
  const [y, rm, rd] = ref.split('-').map(Number)
  const year = month < rm || (month === rm && day <= rd) ? y : y - 1
  return toIsoDate(`${month}/${day}/${year}`) ?? m[0]
}

/** The amount a ROW_AMOUNT match reads as, ignoring its sign. */
function amountValue(m: RegExpExecArray): number {
  return Number(`${m[3].replace(/,/g, '')}.${m[4]}`)
}

/** True when a ROW_AMOUNT match is written as a credit: minus sign, parentheses, "CR", or a trailing minus. */
function isCredit(m: RegExpExecArray): boolean {
  return (!!m[1] && m[1] !== '+') || !!m[2] || !!m[5]
}

function headingOf(text: string): Section | undefined {
  for (const [rx, section] of HEADINGS) if (rx.test(text)) return section
  return undefined
}

/** Reads the purchases out of a statement's lines. */
export function parseStatement(lines: Line[]): PdfStatement {
  const closing = findClosingDate(lines)
  const purchases: Purchase[] = []
  let skipped = 0
  let section: Section = null
  let printed: number | null = null
  let found = 0
  let sawPurchaseSection = false

  for (const line of lines) {
    // Cells joined with tabs, so column boundaries survive for spotting number-only columns.
    const text = line.cells.map((c) => c.text).join('\t')
    const date = ROW_DATE.exec(text)
    const amount = date ? ROW_AMOUNT.exec(text) : null

    if (!date || !amount) {
      const plain = line.text.trim()
      if (PURCHASE_TOTAL.test(plain)) {
        const total = ROW_AMOUNT.exec(plain)
        // The transaction list's own total wins over the summary's.
        if (total && (printed === null || /^total/i.test(plain))) printed = amountValue(total)
      }
      if (/^total\b/i.test(plain)) continue
      const heading = headingOf(plain)
      if (heading) {
        section = heading
        if (heading === 'purchases') sawPurchaseSection = true
      }
      continue
    }

    // Everything between the date(s) and the amount, minus reference-number columns.
    let middle = text.slice(date[0].length, amount.index).replace(/^[\s\t]+/, '')
    const posting = ROW_DATE.exec(middle)
    if (posting) middle = middle.slice(posting[0].length)
    const desc = middle
      .split('\t')
      .map((part) => part.trim())
      .filter((part) => part && !NUMBERS_ONLY.test(part))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!desc) continue

    const value = amountValue(amount)
    if (isCredit(amount) || section === 'credits' || PAYMENT_RX.test(desc)) {
      skipped++
      continue
    }
    if (value === 0) continue
    purchases.push({ desc, amount: value, date: rowDate(date, closing), cat: '' })
    if (section === 'purchases' || !sawPurchaseSection) found += value
  }

  return {
    purchases,
    skipped,
    check: printed !== null ? { printed, found: Math.round(found * 100) / 100 } : null,
    closing,
  }
}
