// CSV helpers: find the header row, guess which columns hold what, then turn raw rows into purchases.
// Pure functions only. `CSVSource` (src/sources/csvSource.ts) wires them together.

import Papa from 'papaparse'
import type { Transaction } from '../types'
import { normalizeDate } from './dates'
import { makeId } from './format'

/** The file as a grid of trimmed cells, blank lines removed. */
export type Grid = string[][]

export type CsvRow = Record<string, string>

export interface ColumnMap {
  desc: string
  amount: string
  date: string
  /** Optional. Empty string = no category column. */
  category: string
}

/** Header row + data rows, keyed by column name. */
export interface Table {
  headers: string[]
  rows: CsvRow[]
}

/** A purchase row as shown in the import preview, before it becomes a Transaction. */
export interface Purchase {
  desc: string
  amount: number
  date: string
  cat: string
}

/** Card payments and credits aren't purchases, so they're skipped. */
export const PAYMENT_RX = /payment|autopay|thank you|online pmt|e-payment/i

/** Only the first lines of a file are considered when looking for the header row. */
const HEADER_SEARCH_LIMIT = 30

/** Words that show up in bank-export column names. */
const HEADER_WORDS = [
  'date',
  'description',
  'desc',
  'amount',
  'merchant',
  'payee',
  'memo',
  'debit',
  'credit',
  'category',
  'type',
  'name',
  'posted',
  'transaction',
  'balance',
  'reference',
  'details',
]

/** Name hints per field, strongest first. */
const NAME_HINTS: Record<keyof ColumnMap, string[]> = {
  desc: ['description', 'merchant', 'payee', 'desc', 'details', 'memo', 'name'],
  amount: ['amount', 'debit'],
  date: ['transaction date', 'trans date', 'date', 'posted'],
  category: ['category'],
}

const DATE_RX = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})$/

/**
 * Parses "$1,234.50", "-12.00", or accounting-style "(12.50)" into a number.
 * Returns NaN if it isn't one.
 */
export function parseAmount(raw: string | undefined): number {
  let s = String(raw ?? '').replace(/[$,\s]/g, '')
  if (s === '') return NaN
  const parens = /^\((.*)\)$/.exec(s)
  if (parens) s = `-${parens[1]}`
  return Number(s)
}

function looksLikeDate(s: string): boolean {
  return DATE_RX.test(s.trim())
}

/** A cell that reads like data (a date or a number), not a column name. */
function looksLikeData(s: string): boolean {
  return s !== '' && (looksLikeDate(s) || !Number.isNaN(parseAmount(s)))
}

/** Number of cells up to and including the last non-blank one. */
function rowWidth(row: string[]): number {
  for (let i = row.length - 1; i >= 0; i--) if (row[i] !== '') return i + 1
  return 0
}

/** Parses CSV text into a grid of trimmed cells. Everything stays in memory on this device. */
export function parseGrid(text: string): Grid {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  return res.data.map((row) => row.map((c) => String(c ?? '').trim())).filter((row) => rowWidth(row) > 0)
}

/** The most common row width: how many columns the transaction table has. */
function tableWidth(grid: Grid): number {
  const counts = new Map<number, number>()
  for (const row of grid) {
    const w = rowWidth(row)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  let best = 0
  let bestCount = 0
  for (const [w, c] of counts) {
    if (c > bestCount || (c === bestCount && w > best)) {
      best = w
      bestCount = c
    }
  }
  return best
}

/**
 * Finds the row holding the column names, skipping any preamble above it
 * (account number, statement period, ...). Returns -1 when the file has no header row.
 */
export function findHeaderRow(grid: Grid): number {
  const limit = Math.min(grid.length, HEADER_SEARCH_LIMIT)
  const isLabelRow = (row: string[]) => row.filter((c) => c !== '').length >= 2 && !row.some(looksLikeData)

  // Best signal: a row of labels that uses at least two familiar column words.
  for (let i = 0; i < limit; i++) {
    const row = grid[i]
    const hits = row.filter((c) => HEADER_WORDS.some((w) => c.toLowerCase().includes(w))).length
    if (hits >= 2 && isLabelRow(row)) return i
  }

  // Otherwise: the first row of labels that's as wide as the table and has data right below it.
  const width = tableWidth(grid)
  for (let i = 0; i < limit - 1; i++) {
    if (rowWidth(grid[i]) === width && isLabelRow(grid[i]) && grid[i + 1].some(looksLikeData)) return i
  }
  return -1
}

/** Makes column names usable as keys: blanks become "Column N", repeats get " (2)". */
function uniqueHeaders(raw: string[], width: number): string[] {
  const seen = new Map<string, number>()
  const out: string[] = []
  for (let i = 0; i < width; i++) {
    const base = raw[i] || `Column ${i + 1}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    out.push(n === 1 ? base : `${base} (${n})`)
  }
  return out
}

/** Turns the grid into named rows, using `headerRow` for column names (-1 = no header row). */
export function toTable(grid: Grid, headerRow: number): Table {
  const width = Math.max(tableWidth(grid), headerRow >= 0 ? rowWidth(grid[headerRow]) : 0)
  const headers = uniqueHeaders(headerRow >= 0 ? grid[headerRow] : [], width)
  const rows = grid.slice(headerRow + 1).map((cells) => {
    const row: CsvRow = {}
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''))
    return row
  })
  return { headers, rows }
}

/** Up to 50 non-blank values from a column, for guessing what it holds. */
function sample(rows: CsvRow[], col: string): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (r[col]) out.push(r[col])
    if (out.length >= 50) break
  }
  return out
}

function mostly(values: string[], test: (v: string) => boolean): boolean {
  return values.length > 0 && values.filter(test).length / values.length >= 0.8
}

/**
 * Guesses the description / amount / date / category columns.
 * Tries column names first; for anything still missing, looks at the values.
 * Empty string = no guess.
 */
export function detectColumns(headers: string[], rows: CsvRow[] = []): ColumnMap {
  const byName = (field: keyof ColumnMap) => {
    for (const hint of NAME_HINTS[field]) {
      const h = headers.find((x) => x.toLowerCase().includes(hint))
      if (h) return h
    }
    return ''
  }
  const map: ColumnMap = {
    desc: byName('desc'),
    amount: byName('amount'),
    date: byName('date'),
    category: byName('category'),
  }

  const taken = () => new Set(Object.values(map).filter(Boolean))
  const free = () => headers.filter((h) => !taken().has(h))

  if (!map.date) {
    map.date = free().find((h) => mostly(sample(rows, h), looksLikeDate)) ?? ''
  }
  if (!map.amount) {
    // Money columns have cents; check numbers and reference ids usually don't.
    const numeric = free().filter((h) => mostly(sample(rows, h), (v) => !looksLikeDate(v) && !Number.isNaN(parseAmount(v))))
    map.amount = numeric.find((h) => sample(rows, h).some((v) => v.includes('.'))) ?? numeric[0] ?? ''
  }
  if (!map.desc) {
    // The description is the wordiest text column.
    let best = ''
    let bestLen = 0
    for (const h of free()) {
      const vals = sample(rows, h).filter((v) => !looksLikeData(v))
      const avg = vals.reduce((s, v) => s + v.length, 0) / (vals.length || 1)
      if (vals.length && avg > bestLen) {
        best = h
        bestLen = avg
      }
    }
    map.desc = best
  }
  return map
}

/** True when most amounts are negative, i.e. this bank shows purchases as negative numbers. */
export function detectNegativePurchases(rows: CsvRow[], amountCol: string): boolean {
  let neg = 0
  let pos = 0
  for (const r of rows) {
    const v = parseAmount(r[amountCol])
    if (!Number.isNaN(v)) {
      if (v < 0) neg++
      else pos++
    }
  }
  return neg > pos
}

/** Rows → purchases using the chosen columns. Keeps only purchases (by sign), skips payments. */
export function toPurchases(rows: CsvRow[], map: ColumnMap, negativePurchases: boolean): Purchase[] {
  if (!map.desc || !map.amount) return []
  const cell = (r: CsvRow, col: string) => (col ? String(r[col] ?? '').trim() : '')
  const out: Purchase[] = []
  for (const r of rows) {
    const desc = cell(r, map.desc)
    const n = parseAmount(r[map.amount])
    if (!desc || Number.isNaN(n)) continue
    if (negativePurchases ? n >= 0 : n <= 0) continue
    if (PAYMENT_RX.test(desc)) continue
    out.push({ desc, amount: Math.abs(n), date: normalizeDate(cell(r, map.date)), cat: cell(r, map.category) })
  }
  return out
}

/** Purchases → fresh, unreviewed transactions. */
export function toTransactions(purchases: Purchase[]): Transaction[] {
  return purchases.map((p) => ({
    id: makeId('t'),
    desc: p.desc,
    amount: p.amount,
    date: p.date,
    cat: p.cat || '—',
    status: 'unreviewed',
    pileId: null,
    action: null,
    note: '',
    sus: false,
    loc: null,
  }))
}
