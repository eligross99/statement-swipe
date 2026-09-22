// CSV helpers: guess which columns hold what, then turn raw rows into purchases.
// Phase 3 wraps these in a `CSVSource` and adds header-row detection.

import type { Transaction } from '../types'
import { makeId } from './format'

export type CsvRow = Record<string, string>

export interface ColumnMap {
  desc: string
  amount: string
  date: string
}

/** A purchase row as shown in the import preview, before it becomes a Transaction. */
export interface Purchase {
  desc: string
  amount: number
  date: string
}

/** Card payments and credits aren't purchases, so they're skipped. */
const PAYMENT_RX = /payment|autopay|thank you|online pmt|e-payment/i

/** Parses "$1,234.50" or "-12.00" into a number (NaN if it isn't one). */
export function parseAmount(raw: string | undefined): number {
  const cleaned = String(raw ?? '').replace(/[$,]/g, '').trim()
  return cleaned === '' ? NaN : Number(cleaned)
}

/** Drops rows that are entirely blank. */
export function nonEmptyRows(rows: CsvRow[]): CsvRow[] {
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim()))
}

/** Column names from the first row, trimmed, blanks removed. */
export function headersOf(rows: CsvRow[]): string[] {
  return rows.length ? Object.keys(rows[0]).map((k) => k.trim()).filter(Boolean) : []
}

/** Guesses the description / amount / date columns by name. Empty string = no guess. */
export function detectColumns(headers: string[]): ColumnMap {
  const find = (subs: string[]) => headers.find((h) => subs.some((s) => h.toLowerCase().includes(s))) ?? ''
  return {
    desc: find(['description', 'merchant', 'name', 'payee', 'memo']),
    amount: find(['amount', 'debit']),
    date: find(['date']),
  }
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
  const out: Purchase[] = []
  for (const r of rows) {
    const desc = String(r[map.desc] ?? '').trim()
    const n = parseAmount(r[map.amount])
    if (!desc || Number.isNaN(n)) continue
    if (negativePurchases ? n >= 0 : n <= 0) continue
    if (PAYMENT_RX.test(desc)) continue
    out.push({ desc, amount: Math.abs(n), date: map.date ? String(r[map.date] ?? '').trim() : '' })
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
    cat: '—',
    status: 'unreviewed',
    pileId: null,
    action: null,
    note: '',
    sus: false,
    loc: null,
  }))
}
