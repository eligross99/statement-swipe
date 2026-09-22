import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa from 'papaparse'
import {
  detectColumns,
  detectNegativePurchases,
  headersOf,
  nonEmptyRows,
  parseAmount,
  toPurchases,
  toTransactions,
  type CsvRow,
} from './csv'

function parseFixture(name: string): CsvRow[] {
  const text = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8')
  const res = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })
  return nonEmptyRows(res.data)
}

describe('parseAmount', () => {
  it('handles dollar signs, commas, and negatives', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5)
    expect(parseAmount('-12.00')).toBe(-12)
    expect(parseAmount('$-2.50')).toBe(-2.5)
  })

  it('returns NaN for blanks and junk', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount(undefined)).toBeNaN()
    expect(parseAmount('n/a')).toBeNaN()
  })
})

describe('detectColumns', () => {
  it('guesses description, amount, and date by name', () => {
    expect(detectColumns(['Transaction Date', 'Description', 'Amount'])).toEqual({
      desc: 'Description',
      amount: 'Amount',
      date: 'Transaction Date',
    })
  })

  it('recognizes alternate names', () => {
    expect(detectColumns(['Posted', 'Payee', 'Debit'])).toEqual({ desc: 'Payee', amount: 'Debit', date: '' })
  })

  it('leaves a column blank when nothing matches', () => {
    expect(detectColumns(['foo', 'bar'])).toEqual({ desc: '', amount: '', date: '' })
  })
})

describe('a bank export where purchases are negative', () => {
  const rows = parseFixture('negative-purchases.csv')
  const map = detectColumns(headersOf(rows))

  it('detects the sign convention', () => {
    expect(detectNegativePurchases(rows, map.amount)).toBe(true)
  })

  it('keeps purchases only: skips payments, refunds, and rows without a description', () => {
    const purchases = toPurchases(rows, map, true)
    expect(purchases).toEqual([
      { desc: 'FAKE COFFEE CO #1', amount: 4.75, date: '03/02/2026' },
      { desc: 'EXAMPLE GROCERY 22', amount: 1204.1, date: '03/04/2026' },
      { desc: 'SAMPLE TRANSIT', amount: 2.5, date: '03/09/2026' },
    ])
  })

  it('with the sign toggle flipped, only the refund counts', () => {
    expect(toPurchases(rows, map, false)).toEqual([{ desc: 'TEST BOOKSHOP', amount: 12, date: '03/07/2026' }])
  })
})

describe('toPurchases', () => {
  const rows: CsvRow[] = [
    { Desc: 'SHOP A', Amt: '10.00' },
    { Desc: 'ONLINE PMT RECEIVED', Amt: '99.00' },
    { Desc: 'SHOP B', Amt: '0' },
  ]

  it('returns nothing until description and amount are both mapped', () => {
    expect(toPurchases(rows, { desc: 'Desc', amount: '', date: '' }, false)).toEqual([])
  })

  it('treats positive numbers as purchases by default and ignores zero', () => {
    expect(toPurchases(rows, { desc: 'Desc', amount: 'Amt', date: '' }, false)).toEqual([
      { desc: 'SHOP A', amount: 10, date: '' },
    ])
  })
})

describe('toTransactions', () => {
  it('creates unreviewed transactions with unique ids', () => {
    const txns = toTransactions([
      { desc: 'A', amount: 1, date: '' },
      { desc: 'B', amount: 2, date: '' },
    ])
    expect(txns.map((t) => t.status)).toEqual(['unreviewed', 'unreviewed'])
    expect(txns.every((t) => t.pileId === null && t.action === null && t.note === '' && t.cat === '—')).toBe(true)
    expect(new Set(txns.map((t) => t.id)).size).toBe(2)
  })
})
